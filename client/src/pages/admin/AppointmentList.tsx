import {
  Card,
  Select,
  Button,
  Space,
  Row,
  Col,
  Table,
  Tag,
  Avatar,
  Typography,
  Tooltip,
  message,
  Popconfirm,
  DatePicker,
  Input,
} from 'antd';
import {
  UserOutlined,
  SearchOutlined,
  ReloadOutlined,
  PrinterOutlined,
  StopOutlined,
  CalendarOutlined,
  PhoneOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import { useAuthStore } from '../../store/auth';
import type {
  Appointment,
  Department,
  ServiceItem,
} from '../../types';
import { AppointmentStatusText } from '../../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface AdminAppointment extends Appointment {
  service_item_name?: string;
  service_item_code?: string;
  user_name?: string;
  user_phone?: string;
  department_name?: string;
}

interface AppointmentsResponse {
  appointments: AdminAppointment[];
  total: number;
  page: number;
  pageSize: number;
}

function AppointmentList() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);

  const [status, setStatus] = useState<string>('');
  const [serviceItemId, setServiceItemId] = useState<string>('');
  const [dateRange, setDateRange] = useState<any>(null);
  const [keyword, setKeyword] = useState<string>('');
  const [checkingInId, setCheckingInId] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string>('');

  useEffect(() => {
    loadDepartments();
    loadServiceItems();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [page, pageSize, status, serviceItemId, dateRange, keyword]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadServiceItems = async (deptId?: string) => {
    try {
      const res: any = await api.get('/service/service-items/all');
      const items = res.items || [];
      if (deptId) {
        setServiceItems(items.filter((item: ServiceItem) => item.department_id === deptId));
      } else {
        setServiceItems(items);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
      };
      if (status) params.status = status;
      if (serviceItemId) params.service_item_id = serviceItemId;
      if (keyword) params.keyword = keyword;
      if (dateRange && dateRange.length === 2) {
        params.date = dateRange[0];
      }
      const res: AppointmentsResponse = await api.get('/appointments', { params });
      setAppointments(res.appointments);
      setTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadAppointments();
  };

  const handleReset = () => {
    setStatus('');
    setServiceItemId('');
    setDateRange(null);
    setKeyword('');
    setPage(1);
    setTimeout(() => loadAppointments(), 0);
  };

  const canCheckIn = (record: AdminAppointment): boolean => {
    if (record.status !== 'confirmed') return false;
    if (dayjs(record.appointment_date).isBefore(dayjs().format('YYYY-MM-DD'))) return false;
    return true;
  };

  const canCancel = (record: AdminAppointment): boolean => {
    return record.status !== 'cancelled' && record.status !== 'completed';
  };

  const handleCheckIn = async (record: AdminAppointment) => {
    setCheckingInId(record.id);
    try {
      const res: any = await api.post(`/appointments/${record.id}/check-in`);
      if (res.is_idempotent) {
        message.info(`已存在号票：${res.ticket.ticket_number}`);
      } else {
        message.success(`签到取号成功！号票：${res.ticket.ticket_number}`);
      }
      loadAppointments();
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingInId('');
    }
  };

  const handleCancel = async (record: AdminAppointment) => {
    setCancellingId(record.id);
    try {
      await api.post(`/appointments/${record.id}/cancel`);
      message.success('预约已取消');
      loadAppointments();
    } catch (error) {
      console.error(error);
    } finally {
      setCancellingId('');
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      confirmed: 'green',
      cancelled: 'default',
      completed: 'blue',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 130,
      render: (name: string, record: AdminAppointment) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div>{name}</div>
            {record.user_name && record.user_name !== name && (
              <div style={{ fontSize: 11, color: '#999' }}>账号：{record.user_name}</div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '联系电话',
      dataIndex: 'applicant_phone',
      key: 'applicant_phone',
      width: 140,
      render: (phone: string, record: AdminAppointment) => (
        <Space>
          <PhoneOutlined style={{ color: '#999', fontSize: 12 }} />
          <span>{phone || record.user_phone || '-'}</span>
        </Space>
      ),
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
      width: 180,
      render: (name: string, record: AdminAppointment) => (
        <Tooltip title={`编码：${record.service_item_code || '-'}`}>
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>{name}</span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 130,
    },
    {
      title: '预约日期',
      dataIndex: 'appointment_date',
      key: 'appointment_date',
      width: 130,
      render: (date: string, record: AdminAppointment) => (
        <Space>
          <CalendarOutlined style={{ color: '#999' }} />
          <div>
            <div>{dayjs(date).format('YYYY-MM-DD')}</div>
            {record.time_slot && (
              <Text type="secondary" style={{ fontSize: 12 }}>{record.time_slot}</Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} style={{ fontSize: 13, padding: '2px 10px' }}>
          {AppointmentStatusText[status as keyof typeof AppointmentStatusText]}
        </Tag>
      ),
    },
    {
      title: '预约时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => (
        <Text type="secondary">{dayjs(time).format('YYYY-MM-DD HH:mm')}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: AdminAppointment) => (
        <Space size="small">
          {(user?.role === 'window' || user?.role === 'admin') && (
            <Tooltip title={canCheckIn(record) ? '为该预约签到取号' : '仅已确认且未过期的预约可取号'}>
              <Button
                type="primary"
                size="small"
                icon={<PrinterOutlined />}
                disabled={!canCheckIn(record)}
                loading={checkingInId === record.id}
                onClick={() => handleCheckIn(record)}
              >
                一键取号
              </Button>
            </Tooltip>
          )}
          {(user?.role === 'admin' || user?.role === 'window' || user?.role === 'approver') && (
            <Popconfirm
              title="确定要取消该预约吗？"
              description="取消后将释放号源，此操作不可撤销。"
              onConfirm={() => handleCancel(record)}
              okText="确定取消"
              okButtonProps={{ danger: true }}
              cancelText="返回"
              disabled={!canCancel(record) || cancellingId === record.id}
            >
              <Button
                danger
                size="small"
                icon={<StopOutlined />}
                disabled={!canCancel(record)}
                loading={cancellingId === record.id}
              >
                取消预约
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: '0 0 16px 0' }}>预约管理</Title>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Select
              placeholder="预约状态"
              value={status || undefined}
              onChange={setStatus}
              style={{ width: '100%' }}
              allowClear
            >
              <Select.Option value="pending">待确认</Select.Option>
              <Select.Option value="confirmed">已确认</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="服务事项"
              value={serviceItemId || undefined}
              onChange={setServiceItemId}
              style={{ width: '100%' }}
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
          </Col>
          <Col span={6}>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col span={6}>
            <Input
              placeholder="申请人姓名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<UserOutlined style={{ color: '#999' }} />}
              allowClear
            />
          </Col>
        </Row>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={appointments}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条预约`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
}

export default AppointmentList;
