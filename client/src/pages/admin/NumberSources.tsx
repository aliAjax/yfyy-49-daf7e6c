import { Card, Table, Button, Select, Modal, Form, InputNumber, DatePicker, message, Space, Progress, Row, Col, Statistic } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { NumberSource, ServiceItem } from '../../types';

const { RangePicker } = DatePicker;

function NumberSources() {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<NumberSource[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [serviceItemId, setServiceItemId] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState<NumberSource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generateForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadServiceItems();
    loadNumberSources();
  }, []);

  const loadServiceItems = async () => {
    try {
      const res: any = await api.get('/service/service-items/all');
      setServiceItems(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadNumberSources = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (serviceItemId) {
        params.service_item_id = serviceItemId;
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res: any = await api.get('/service/number-sources', { params });
      setSources(res.sources || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadNumberSources();
  };

  const handleReset = () => {
    setServiceItemId('');
    setDateRange(null);
    loadNumberSources();
  };

  const handleGenerate = () => {
    generateForm.resetFields();
    setGenerateModalVisible(true);
  };

  const handleGenerateSubmit = async () => {
    try {
      const values = await generateForm.validateFields();
      setSubmitting(true);

      const params = {
        service_item_id: values.service_item_id,
        start_date: values.date_range[0].format('YYYY-MM-DD'),
        end_date: values.date_range[1].format('YYYY-MM-DD'),
        total_count: values.total_count,
      };

      const res: any = await api.post('/service/number-sources/generate', params);
      message.success(res.message || '生成成功');
      setGenerateModalVisible(false);
      loadNumberSources();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (source: NumberSource) => {
    setEditingSource(source);
    editForm.setFieldsValue({
      total_count: source.total_count,
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);

      await api.put(`/service/number-sources/${editingSource?.id}`, {
        total_count: values.total_count,
      });
      message.success('编辑成功');
      setEditModalVisible(false);
      loadNumberSources();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const getServiceItemName = (serviceItemId: string) => {
    const item = serviceItems.find((s) => s.id === serviceItemId);
    return item?.name || '-';
  };

  const getRemainingCount = (source: NumberSource) => {
    return source.total_count - source.booked_count;
  };

  const getProgressPercent = (source: NumberSource) => {
    if (source.total_count === 0) return 0;
    return Math.round((source.booked_count / source.total_count) * 100);
  };

  const totalStats = sources.reduce(
    (acc, source) => {
      acc.total += source.total_count;
      acc.booked += source.booked_count;
      acc.remaining += source.total_count - source.booked_count;
      return acc;
    },
    { total: 0, booked: 0, remaining: 0 }
  );

  const columns = [
    {
      title: '服务事项',
      dataIndex: 'service_item_id',
      key: 'service_item_id',
      width: 200,
      render: (id: string) => getServiceItemName(id),
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '总号源',
      dataIndex: 'total_count',
      key: 'total_count',
      width: 100,
    },
    {
      title: '已预约',
      dataIndex: 'booked_count',
      key: 'booked_count',
      width: 100,
    },
    {
      title: '剩余号源',
      key: 'remaining_count',
      width: 120,
      render: (_: any, record: NumberSource) => getRemainingCount(record),
    },
    {
      title: '预约进度',
      key: 'progress',
      render: (_: any, record: NumberSource) => (
        <Progress
          percent={getProgressPercent(record)}
          size="small"
          status={getProgressPercent(record) >= 100 ? 'exception' : 'active'}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: NumberSource) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16}>
          <Select
            placeholder="选择服务事项"
            value={serviceItemId || undefined}
            onChange={setServiceItemId}
            style={{ width: 250 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {serviceItems.map((item) => (
              <Select.Option key={item.id} value={item.id}>
                {item.name}
              </Select.Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总号源数"
              value={totalStats.total}
              prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已预约数"
              value={totalStats.booked}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="剩余号源"
              value={totalStats.remaining}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="号源列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleGenerate}>
            批量生成号源
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={sources}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="批量生成号源"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setGenerateModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleGenerateSubmit}>
            生成
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={generateForm} layout="vertical">
          <Form.Item
            name="service_item_id"
            label="服务事项"
            rules={[{ required: true, message: '请选择服务事项' }]}
          >
            <Select placeholder="请选择服务事项" showSearch optionFilterProp="children">
              {serviceItems.map((item) => (
                <Select.Option key={item.id} value={item.id}>
                  {item.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="date_range"
            label="日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="total_count"
            label="每日号源数量"
            rules={[{ required: true, message: '请输入号源数量' }]}
          >
            <InputNumber min={1} max={999} style={{ width: '100%' }} placeholder="请输入每日号源数量" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑号源数量"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleEditSubmit}>
            确定
          </Button>,
        ]}
        width={400}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="total_count"
            label="总号源数量"
            rules={[{ required: true, message: '请输入号源数量' }]}
          >
            <InputNumber min={editingSource?.booked_count || 0} max={999} style={{ width: '100%' }} placeholder="请输入总号源数量" />
          </Form.Item>
          <p style={{ color: '#999', fontSize: 12 }}>
            当前已预约：{editingSource?.booked_count || 0} 个，总号源数不能小于已预约数
          </p>
        </Form>
      </Modal>
    </div>
  );
}

export default NumberSources;
