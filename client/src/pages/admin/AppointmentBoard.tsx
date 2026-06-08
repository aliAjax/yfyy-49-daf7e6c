import { Badge, Button, Card, Col, Descriptions, Modal, Row, Select, Space, Statistic, Table, Tag } from 'antd';
import { CalendarOutlined, ReloadOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import { useAuthStore } from '../../store/auth';
import type {
  Appointment,
  AppointmentBoardDay,
  AppointmentBoardSummary,
  Department,
  ServiceItem,
} from '../../types';
import { AppointmentStatusText } from '../../types';

function AppointmentBoard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [serviceItemId, setServiceItemId] = useState<string | undefined>();
  const [days, setDays] = useState<AppointmentBoardDay[]>([]);
  const [summary, setSummary] = useState<AppointmentBoardSummary>({
    total_count: 0,
    booked_count: 0,
    remaining_count: 0,
    appointment_count: 0,
  });
  const [rangeText, setRangeText] = useState('');
  const [selectedDay, setSelectedDay] = useState<AppointmentBoardDay | null>(null);

  const isWindowUser = user?.role === 'window';

  useEffect(() => {
    loadDepartments();
    loadServiceItems();
    loadBoard();
  }, []);

  const filteredServiceItems = useMemo(() => {
    if (isWindowUser) {
      return serviceItems;
    }

    if (!departmentId) {
      return serviceItems;
    }
    return serviceItems.filter((item) => item.department_id === departmentId);
  }, [departmentId, isWindowUser, serviceItems]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadServiceItems = async () => {
    try {
      const res: any = await api.get('/service/service-items/all');
      setServiceItems(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadBoard = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (!isWindowUser && departmentId) {
        params.department_id = departmentId;
      }
      if (serviceItemId) {
        params.service_item_id = serviceItemId;
      }

      const res: any = await api.get('/appointments/board/summary', { params });
      setDays(res.days || []);
      setSummary(res.summary || {
        total_count: 0,
        booked_count: 0,
        remaining_count: 0,
        appointment_count: 0,
      });
      setRangeText(`${res.start_date || ''} 至 ${res.end_date || ''}`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (value?: string) => {
    setDepartmentId(value);
    setServiceItemId(undefined);
  };

  const handleReset = () => {
    setDepartmentId(undefined);
    setServiceItemId(undefined);
    setTimeout(loadBoard, 0);
  };

  const getUsagePercent = (record: AppointmentBoardDay) => {
    if (!record.total_count) {
      return 0;
    }
    return Math.round((record.booked_count / record.total_count) * 100);
  };

  const dayColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (date: string, record: AppointmentBoardDay) => (
        <Button type="link" onClick={() => setSelectedDay(record)} style={{ padding: 0 }}>
          {dayjs(date).format('YYYY-MM-DD')}
        </Button>
      ),
    },
    {
      title: '星期',
      dataIndex: 'date',
      key: 'weekday',
      width: 90,
      render: (date: string) => `周${'日一二三四五六'[dayjs(date).day()]}`,
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
      title: '剩余号数',
      dataIndex: 'remaining_count',
      key: 'remaining_count',
      width: 110,
      render: (value: number) => (
        <Tag color={value > 0 ? 'green' : 'red'}>{value}</Tag>
      ),
    },
    {
      title: '预约名单',
      dataIndex: 'appointment_count',
      key: 'appointment_count',
      width: 110,
      render: (value: number, record: AppointmentBoardDay) => (
        <Button type="link" onClick={() => setSelectedDay(record)} style={{ padding: 0 }}>
          {value}人
        </Button>
      ),
    },
    {
      title: '服务事项',
      dataIndex: 'service_items',
      key: 'service_items',
      render: (_: any, record: AppointmentBoardDay) => (
        <Space size={[8, 8]} wrap>
          {record.service_items.length ? record.service_items.map((item) => (
            <Tag key={`${record.date}-${item.service_item_id}`}>
              {item.service_item_name} {item.remaining_count}/{item.total_count}
            </Tag>
          )) : <span style={{ color: '#999' }}>暂无号源</span>}
        </Space>
      ),
    },
    {
      title: '使用率',
      key: 'usage',
      width: 120,
      render: (_: any, record: AppointmentBoardDay) => `${getUsagePercent(record)}%`,
    },
  ];

  const appointmentColumns = [
    {
      title: '预约人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 120,
      render: (value: string, record: Appointment) => value || record.user_name || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'applicant_phone',
      key: 'applicant_phone',
      width: 130,
      render: (value: string, record: Appointment) => value || record.user_phone || '-',
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
    },
    {
      title: '时段',
      dataIndex: 'time_slot',
      key: 'time_slot',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Appointment['status']) => (
        <Badge status={status === 'cancelled' ? 'default' : 'processing'} text={AppointmentStatusText[status]} />
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Select
            placeholder="选择科室"
            style={{ width: 180 }}
            value={isWindowUser ? user?.department_id : departmentId}
            onChange={handleDepartmentChange}
            allowClear={!isWindowUser}
            disabled={isWindowUser}
            options={departments.map((department) => ({ label: department.name, value: department.id }))}
          />
          <Select
            placeholder="选择服务事项"
            style={{ width: 240 }}
            value={serviceItemId}
            onChange={setServiceItemId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={filteredServiceItems.map((item) => ({ label: item.name, value: item.id }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={loadBoard}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="未来30天总号源" value={summary.total_count} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已预约" value={summary.booked_count} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="剩余号数" value={summary.remaining_count} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="预约名单人数" value={summary.appointment_count} prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title="预约日历看板" extra={rangeText}>
        <Table
          columns={dayColumns}
          dataSource={days}
          rowKey="date"
          loading={loading}
          pagination={false}
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        title={selectedDay ? `${selectedDay.date} 预约名单` : '预约名单'}
        open={!!selectedDay}
        onCancel={() => setSelectedDay(null)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {selectedDay && (
          <>
            <Descriptions size="small" column={4} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="总号源">{selectedDay.total_count}</Descriptions.Item>
              <Descriptions.Item label="已预约">{selectedDay.booked_count}</Descriptions.Item>
              <Descriptions.Item label="剩余号数">{selectedDay.remaining_count}</Descriptions.Item>
              <Descriptions.Item label="名单人数">{selectedDay.appointment_count}</Descriptions.Item>
            </Descriptions>
            <Table
              columns={appointmentColumns}
              dataSource={selectedDay.appointments}
              rowKey="id"
              pagination={{ pageSize: 8 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

export default AppointmentBoard;
