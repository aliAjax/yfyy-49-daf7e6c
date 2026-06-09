import { Badge, Button, Card, DatePicker, Input, Select, Space, Table, Tag, message } from 'antd';
import { ReloadOutlined, SearchOutlined, NumberOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { Appointment, AppointmentStatus, ServiceItem, Ticket } from '../../types';
import { AppointmentStatusText } from '../../types';

const { RangePicker } = DatePicker;

function AppointmentList() {
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [status, setStatus] = useState<AppointmentStatus | undefined>('confirmed');
  const [serviceItemId, setServiceItemId] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const loadServiceItems = async () => {
    try {
      const res: any = await api.get('/service/service-items/all');
      setServiceItems(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadAppointments = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (status) {
        params.status = status;
      }
      if (serviceItemId) {
        params.service_item_id = serviceItemId;
      }
      if (keyword.trim()) {
        params.keyword = keyword.trim();
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const res: any = await api.get('/appointments', { params });
      setAppointments(res.appointments || []);
      setPagination({ current: page, pageSize, total: res.total || 0 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceItems();
    loadAppointments(1, pagination.pageSize);
  }, []);

  const serviceOptions = useMemo(
    () => serviceItems.map((item) => ({ label: item.name, value: item.id })),
    [serviceItems]
  );

  const canCheckIn = (record: Appointment) => (
    record.status === 'confirmed' && !dayjs(record.appointment_date).isBefore(dayjs().format('YYYY-MM-DD'))
  );

  const disabledReason = (record: Appointment) => {
    if (record.status !== 'confirmed') {
      return '仅已确认预约可取号';
    }
    if (dayjs(record.appointment_date).isBefore(dayjs().format('YYYY-MM-DD'))) {
      return '过期预约不可取号';
    }
    return '';
  };

  const handleCheckIn = async (record: Appointment) => {
    setCheckingId(record.id);
    try {
      const res: any = await api.post(`/appointments/${record.id}/check-in`);
      const ticket = res.ticket as Ticket;
      if (res.is_idempotent) {
        message.info(`该预约已取号：${ticket.ticket_number}`);
      } else {
        message.success(`取号成功：${ticket.ticket_number}`);
      }
      loadAppointments(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingId(undefined);
    }
  };

  const handleSearch = () => {
    loadAppointments(1, pagination.pageSize);
  };

  const handleReset = () => {
    setStatus('confirmed');
    setServiceItemId(undefined);
    setKeyword('');
    setDateRange(null);
    setTimeout(() => loadAppointments(1, pagination.pageSize), 0);
  };

  const columns = [
    {
      title: '预约人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 140,
      render: (value: string, record: Appointment) => value || record.user_name || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'applicant_phone',
      key: 'applicant_phone',
      width: 140,
      render: (value: string, record: Appointment) => value || record.user_phone || '-',
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
      render: (value: string, record: Appointment) => (
        <Space size={6} wrap>
          <span>{value || '-'}</span>
          {record.service_item_code && <Tag>{record.service_item_code}</Tag>}
        </Space>
      ),
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '预约日期',
      dataIndex: 'appointment_date',
      key: 'appointment_date',
      width: 130,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
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
      width: 110,
      render: (value: AppointmentStatus) => (
        <Badge status={value === 'cancelled' ? 'default' : value === 'completed' ? 'success' : 'processing'} text={AppointmentStatusText[value]} />
      ),
    },
    {
      title: '预约时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right' as const,
      render: (_: unknown, record: Appointment) => {
        const disabled = !canCheckIn(record);
        return (
          <Button
            type="primary"
            size="small"
            icon={<NumberOutlined />}
            disabled={disabled}
            loading={checkingId === record.id}
            title={disabled ? disabledReason(record) : '预约签到取号'}
            onClick={() => handleCheckIn(record)}
          >
            一键取号
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={12} wrap>
          <Select
            placeholder="预约状态"
            style={{ width: 140 }}
            value={status}
            allowClear
            onChange={setStatus}
            options={[
              { label: '待确认', value: 'pending' },
              { label: '已确认', value: 'confirmed' },
              { label: '已取消', value: 'cancelled' },
              { label: '已完成', value: 'completed' },
            ]}
          />
          <Select
            placeholder="服务事项"
            style={{ width: 220 }}
            value={serviceItemId}
            allowClear
            showSearch
            optionFilterProp="label"
            onChange={setServiceItemId}
            options={serviceOptions}
          />
          <RangePicker value={dateRange} onChange={(value) => setDateRange(value)} />
          <Input
            placeholder="预约人"
            style={{ width: 180 }}
            value={keyword}
            allowClear
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={handleSearch}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card title="预约列表">
        <Table
          columns={columns}
          dataSource={appointments}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: loadAppointments,
          }}
        />
      </Card>
    </div>
  );
}

export default AppointmentList;
