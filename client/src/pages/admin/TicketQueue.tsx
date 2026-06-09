import { Card, Button, List, Tag, Statistic, Row, Col, Space, message, Select } from 'antd';
import {
  SoundOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SwapRightOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import type { Ticket, Window, ServiceItem } from '../../types';
import { TicketStatusText } from '../../types';

function TicketQueue() {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [stats, setStats] = useState({
    waiting: 0,
    calling: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
  });
  const [windows, setWindows] = useState<Window[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<string>('');
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [selectedServiceItem, setSelectedServiceItem] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    loadWindows();
    startPolling();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadServiceItems();
    setSelectedServiceItem('');
  }, [selectedWindow]);

  useEffect(() => {
    loadQueue();
    loadStats();
  }, [selectedWindow, selectedServiceItem]);

  const startPolling = () => {
    timerRef.current = window.setInterval(() => {
      loadQueue();
      loadStats();
    }, 5000);
  };

  const loadWindows = async () => {
    try {
      const res: any = await api.get('/system/windows', {
        params: { status: 'open' },
      });
      setWindows(res.windows || []);
      if (res.windows && res.windows.length > 0) {
        setSelectedWindow(res.windows[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadServiceItems = async () => {
    if (!selectedWindow) {
      setServiceItems([]);
      return;
    }
    try {
      const res: any = await api.get('/service/service-items', {
        params: { window_id: selectedWindow, status: 'active', pageSize: 100 },
      });
      setServiceItems(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadQueue = async () => {
    if (!selectedWindow) return;
    setLoading(true);
    try {
      const params: any = { window_id: selectedWindow };
      if (selectedServiceItem) {
        params.service_item_id = selectedServiceItem;
      }
      const res: any = await api.get('/tickets/queue', { params });
      const tickets = res.tickets || [];
      setQueue(tickets.filter((t: Ticket) => t.status === 'waiting'));

      const callingTicket = tickets.find((t: Ticket) => t.status === 'calling');
      if (callingTicket) {
        setCurrentTicket(callingTicket);
      } else {
        setCurrentTicket(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params: any = {};
      if (selectedWindow) {
        params.window_id = selectedWindow;
      }
      if (selectedServiceItem) {
        params.service_item_id = selectedServiceItem;
      }
      const res: any = await api.get('/tickets/stats/today', { params });
      setStats(res.stats || {
        waiting: 0,
        calling: 0,
        processing: 0,
        completed: 0,
        cancelled: 0,
        total: 0,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCallNext = async () => {
    if (queue.length === 0) {
      message.warning('暂无等待中的号票');
      return;
    }
    const nextTicket = queue[0];
    try {
      const res: any = await api.post(`/tickets/${nextTicket.id}/call`, {
        window_id: selectedWindow,
      });
      setCurrentTicket(res.ticket);
      message.success(`已呼叫 ${res.ticket.ticket_number}`);
      loadQueue();
      loadStats();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRecall = async () => {
    if (!currentTicket) {
      message.warning('没有正在呼叫的号票');
      return;
    }
    try {
      const res: any = await api.post(`/tickets/${currentTicket.id}/call`, {
        window_id: selectedWindow,
      });
      setCurrentTicket(res.ticket);
      message.success(`已重新呼叫 ${res.ticket.ticket_number}`);
      loadQueue();
    } catch (error) {
      console.error(error);
    }
  };

  const handleStartProcess = async () => {
    if (!currentTicket) {
      message.warning('没有正在呼叫的号票');
      return;
    }
    try {
      const res: any = await api.post(`/tickets/${currentTicket.id}/start`);
      setCurrentTicket(res.ticket);
      message.success('开始办理');
      loadStats();
    } catch (error) {
      console.error(error);
    }
  };

  const handleComplete = async () => {
    if (!currentTicket) {
      message.warning('没有正在办理的号票');
      return;
    }
    try {
      const res: any = await api.post(`/tickets/${currentTicket.id}/complete`);
      message.success('办理完成');
      setCurrentTicket(null);
      loadQueue();
      loadStats();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancel = async () => {
    if (!currentTicket) {
      message.warning('没有正在呼叫的号票');
      return;
    }
    try {
      const res: any = await api.post(`/tickets/${currentTicket.id}/cancel`);
      message.success('已过号');
      setCurrentTicket(null);
      loadQueue();
      loadStats();
    } catch (error) {
      console.error(error);
    }
  };

  const refreshData = () => {
    loadQueue();
    loadStats();
    message.success('已刷新');
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="等待中"
              value={stats.waiting}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="办理中"
              value={stats.processing + stats.calling}
              prefix={<PlayCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="过号"
              value={stats.cancelled}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={10}>
          <Card
            title="当前叫号"
            extra={
              <Space direction="vertical" size="small" style={{ alignItems: 'flex-end' }}>
                <Space>
                  <Select
                    placeholder="选择窗口"
                    value={selectedWindow || undefined}
                    onChange={setSelectedWindow}
                    style={{ width: 180 }}
                    showSearch
                    optionFilterProp="children"
                  >
                    {windows.map((win) => (
                      <Select.Option key={win.id} value={win.id}>
                        {win.number} - {win.name}
                      </Select.Option>
                    ))}
                  </Select>
                  <Button icon={<ReloadOutlined />} onClick={refreshData}>
                    刷新
                  </Button>
                </Space>
                {serviceItems.length > 0 && (
                  <Select
                    placeholder="选择服务事项（全部）"
                    value={selectedServiceItem || undefined}
                    onChange={setSelectedServiceItem}
                    style={{ width: 260 }}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    {serviceItems.map((item) => (
                      <Select.Option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </Space>
            }
          >
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {currentTicket ? (
                <>
                  <div
                    style={{
                      fontSize: 64,
                      fontWeight: 'bold',
                      color: '#1890ff',
                      marginBottom: 16,
                      letterSpacing: 4,
                    }}
                  >
                    {currentTicket.ticket_number}
                  </div>
                  <div style={{ fontSize: 18, color: '#666', marginBottom: 8 }}>
                    <UserOutlined style={{ marginRight: 8 }} />
                    {currentTicket.applicant_name || '现场群众'}
                  </div>
                  <div style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>
                    {currentTicket.service_item_name}
                  </div>
                  <Tag color={currentTicket.status === 'calling' ? 'blue' : 'green'} style={{ fontSize: 16, padding: '4px 16px' }}>
                    {TicketStatusText[currentTicket.status]}
                  </Tag>
                </>
              ) : (
                <div style={{ fontSize: 24, color: '#ccc', padding: '60px 0' }}>
                  暂无正在呼叫的号票
                </div>
              )}
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                size="large"
                block
                icon={<SoundOutlined />}
                onClick={handleCallNext}
                disabled={queue.length === 0}
              >
                呼叫下一位
              </Button>
              <Button
                size="large"
                block
                icon={<ReloadOutlined />}
                onClick={handleRecall}
                disabled={!currentTicket || currentTicket.status !== 'calling'}
              >
                重新呼叫
              </Button>
              <Row gutter={8}>
                <Col span={12}>
                  <Button
                    size="large"
                    block
                    icon={<PlayCircleOutlined />}
                    onClick={handleStartProcess}
                    disabled={!currentTicket || currentTicket.status !== 'calling'}
                  >
                    开始办理
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    size="large"
                    block
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleComplete}
                    disabled={!currentTicket || currentTicket.status !== 'processing'}
                  >
                    完成办理
                  </Button>
                </Col>
              </Row>
              <Button
                danger
                size="large"
                block
                icon={<SwapRightOutlined />}
                onClick={handleCancel}
                disabled={!currentTicket}
              >
                过号
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={14}>
          <Card title={`等待队列（${queue.length}人）`}>
            <List
              loading={loading}
              dataSource={queue}
              renderItem={(item, index) => (
                <List.Item
                  key={item.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: index === 0 ? '#e6f7ff' : 'transparent',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          backgroundColor: index === 0 ? '#1890ff' : '#d9d9d9',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 'bold',
                        }}
                      >
                        {index + 1}
                      </div>
                    }
                    title={
                      <Space>
                        <span style={{ fontSize: 18, fontWeight: 'bold' }}>
                          {item.ticket_number}
                        </span>
                        {index === 0 && <Tag color="blue">下一位</Tag>}
                      </Space>
                    }
                    description={
                      <Space>
                        <span><UserOutlined /> {item.applicant_name || '现场群众'}</span>
                        <span style={{ color: '#999' }}>|</span>
                        <span>{item.service_item_name}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无等待中的号票' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default TicketQueue;
