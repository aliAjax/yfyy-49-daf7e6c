import { Card, List, Tag, Button, Space, Empty, Spin, Radio, message, Drawer, Checkbox, Divider } from 'antd';
import {
  BellOutlined,
  FileTextOutlined,
  CalendarOutlined,
  StarOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  RightOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import type { Notification } from '../../types';
import dayjs from 'dayjs';

const NotificationTypeText: Record<string, string> = {
  case: '办件通知',
  appointment: '预约通知',
  evaluation: '评价通知',
};

const NotificationTypeIcon: Record<string, React.ReactNode> = {
  case: <FileTextOutlined />,
  appointment: <CalendarOutlined />,
  evaluation: <StarOutlined />,
};

const NotificationTypeColor: Record<string, string> = {
  case: 'blue',
  appointment: 'green',
  evaluation: 'orange',
};

interface CitizenNotificationsProps {
  onUnreadCountChange?: () => void;
}

function CitizenNotifications({ onUnreadCountChange }: CitizenNotificationsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<Notification | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [type, onlyUnread, pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (location.pathname === '/citizen/notifications' && onUnreadCountChange) {
      onUnreadCountChange();
    }
  }, [location.pathname, onUnreadCountChange]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      if (onlyUnread) {
        params.is_read = 0;
      }
      if (type !== 'all') {
        params.type = type;
      }
      const res: any = await api.get('/notifications/my', { params });
      setNotifications(res.notifications || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
      setSelectedIds([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUnreadCount = () => {
    if (onUnreadCountChange) {
      onUnreadCountChange();
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      message.success('标记为已读');
      loadNotifications();
      refreshUnreadCount();
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      message.success('全部标记为已读');
      loadNotifications();
      refreshUnreadCount();
    } catch (error) {
      console.error(error);
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要标记的通知');
      return;
    }
    try {
      await api.post('/notifications/batch-read', { ids: selectedIds });
      message.success(`已将 ${selectedIds.length} 条通知标记为已读`);
      loadNotifications();
      refreshUnreadCount();
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewDetail = async (item: Notification) => {
    setDetailVisible(true);
    setCurrentDetail(item);
    if (item.is_read === 0) {
      try {
        await api.post(`/notifications/${item.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n))
        );
        refreshUnreadCount();
      } catch (error) {
        console.error(error);
      }
    }
    try {
      setDetailLoading(true);
      const res: any = await api.get(`/notifications/${item.id}`);
      if (res.notification) {
        setCurrentDetail(res.notification);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleJumpToRelated = (item: Notification) => {
    if (item.type === 'case' && item.related_id) {
      navigate(`/citizen/cases/${item.related_id}`);
    } else if (item.type === 'appointment') {
      navigate('/citizen/appointments');
    } else if (item.type === 'evaluation') {
      navigate('/citizen/evaluations');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(notifications.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const renderItem = (item: Notification) => (
    <List.Item
      key={item.id}
      style={{
        cursor: 'pointer',
        backgroundColor: item.is_read === 0 ? '#f6ffed' : 'transparent',
        padding: '16px 24px',
      }}
      onClick={() => handleViewDetail(item)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ marginRight: 12, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onChange={(e) => handleSelectItem(item.id, e.target.checked)}
          />
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: item.is_read === 0 ? '#e6f7ff' : '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: item.is_read === 0 ? '#1890ff' : '#bfbfbf',
            fontSize: 18,
            marginRight: 16,
            flexShrink: 0,
          }}
        >
          {NotificationTypeIcon[item.type] || <BellOutlined />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <Space size={8}>
              {item.is_read === 0 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#ff4d4f',
                  }}
                />
              )}
              <span style={{ fontWeight: item.is_read === 0 ? 600 : 400, fontSize: 15 }}>
                {item.title}
              </span>
              <Tag color={NotificationTypeColor[item.type]} style={{ marginLeft: 8 }}>
                {NotificationTypeText[item.type]}
              </Tag>
            </Space>
          </div>
          <div style={{ color: '#666', marginBottom: 8 }}>{item.content}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
          </div>
        </div>
        <Space style={{ marginLeft: 16, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {item.is_read === 0 && (
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkAsRead(item.id)}
            >
              标记已读
            </Button>
          )}
          {item.type === 'case' && item.related_id && (
            <Button type="link" size="small" onClick={() => handleJumpToRelated(item)}>
              查看办件 <RightOutlined style={{ fontSize: 12 }} />
            </Button>
          )}
          <Button type="text" size="small" icon={<EyeOutlined />}>
            详情
          </Button>
        </Space>
      </div>
    </List.Item>
  );

  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;
  const indeterminate = selectedIds.length > 0 && selectedIds.length < notifications.length;

  return (
    <div>
      <Card
        title="消息中心"
        extra={
          <Space>
            <span style={{ color: '#999', fontSize: 13 }}>
              已选择 <span style={{ color: '#1890ff', fontWeight: 600 }}>{selectedIds.length}</span> 条
            </span>
            <Button icon={<CheckOutlined />} onClick={handleBatchMarkAsRead} disabled={selectedIds.length === 0}>
              批量已读
            </Button>
            <Button onClick={handleMarkAllAsRead}>全部已读</Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Radio.Group
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
              buttonStyle="solid"
            >
              <Radio.Button value="all">全部通知</Radio.Button>
              <Radio.Button value="case">办件通知</Radio.Button>
              <Radio.Button value="appointment">预约通知</Radio.Button>
              <Radio.Button value="evaluation">评价通知</Radio.Button>
            </Radio.Group>
            <Checkbox
              indeterminate={indeterminate}
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
            >
              全选本页
            </Checkbox>
          </div>
          <Radio.Group
            value={onlyUnread ? 'unread' : 'all'}
            onChange={(e) => {
              setOnlyUnread(e.target.value === 'unread');
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
          >
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="unread">未读</Radio.Button>
          </Radio.Group>
        </Space>

        <Spin spinning={loading}>
          {notifications.length > 0 ? (
            <List
              itemLayout="horizontal"
              dataSource={notifications}
              renderItem={renderItem}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                onChange: (page, pageSize) =>
                  setPagination({ ...pagination, current: page, pageSize }),
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条消息`,
              }}
            />
          ) : (
            <Empty description="暂无消息" style={{ padding: '40px 0' }} />
          )}
        </Spin>
      </Card>

      <Drawer
        title="通知详情"
        placement="right"
        width={500}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
      >
        {currentDetail && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color={NotificationTypeColor[currentDetail.type]}>
                {NotificationTypeText[currentDetail.type]}
              </Tag>
              {currentDetail.is_read === 1 && <Tag color="default">已读</Tag>}
            </div>
            <h3 style={{ marginBottom: 12 }}>{currentDetail.title}</h3>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 24 }}>
              {currentDetail.content}
            </div>
            <div style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>
              发送时间：{dayjs(currentDetail.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {currentDetail.type === 'case' && currentDetail.related_id && (
              <Button
                type="primary"
                icon={<RightOutlined />}
                onClick={() => handleJumpToRelated(currentDetail)}
              >
                查看关联办件
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default CitizenNotifications;
