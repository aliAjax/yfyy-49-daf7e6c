import {
  Card,
  Select,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Table,
  Modal,
  Tag,
  Tabs,
  Badge,
  Progress,
  List,
  Avatar,
  Typography,
  Tooltip,
  message,
  Popconfirm,
} from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
  PrinterOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import { useAuthStore } from '../../store/auth';
import type {
  CalendarOverview,
  CalendarDay,
  DayAppointment,
  DayAppointmentsResponse,
  Department,
  ServiceItem,
} from '../../types';
import { AppointmentStatusText } from '../../types';

const { Title, Text } = Typography;

function AppointmentCalendar() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [calendarData, setCalendarData] = useState<CalendarOverview | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [serviceItemId, setServiceItemId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dayAppointments, setDayAppointments] = useState<DayAppointment[]>([]);
  const [dayAppointmentsLoading, setDayAppointmentsLoading] = useState(false);
  const [dayAppointmentPage, setDayAppointmentPage] = useState(1);
  const [dayAppointmentTotal, setDayAppointmentTotal] = useState(0);
  const [dayAppointmentPageSize] = useState(20);
  const [dayStatusFilter, setDayStatusFilter] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string>('');

  useEffect(() => {
    loadDepartments();
    loadServiceItems();
    loadCalendarData();
  }, []);

  useEffect(() => {
    if (dayModalVisible && selectedDate) {
      loadDayAppointments(selectedDate);
    }
  }, [dayModalVisible, selectedDate, dayAppointmentPage, dayStatusFilter]);

  useEffect(() => {
    if (dayModalVisible) {
      setDayStatusFilter('');
      setDayAppointmentPage(1);
    }
  }, [dayModalVisible]);

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
      const params: any = { status: 'active' };
      if (deptId) {
        params.department_id = deptId;
      }
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

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const params: any = { days: 30 };
      if (departmentId) {
        params.department_id = departmentId;
      }
      if (serviceItemId) {
        params.service_item_id = serviceItemId;
      }
      const res: any = await api.get('/appointments/calendar/overview', { params });
      setCalendarData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDayAppointments = async (date: string) => {
    setDayAppointmentsLoading(true);
    try {
      const params: any = {
        date,
        page: dayAppointmentPage,
        pageSize: dayAppointmentPageSize,
      };
      if (departmentId) {
        params.department_id = departmentId;
      }
      if (serviceItemId) {
        params.service_item_id = serviceItemId;
      }
      if (dayStatusFilter) {
        params.status = dayStatusFilter;
      }
      const res: DayAppointmentsResponse = await api.get('/appointments/calendar/day-appointments', { params });
      setDayAppointments(res.appointments);
      setDayAppointmentTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setDayAppointmentsLoading(false);
    }
  };

  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value);
    setServiceItemId('');
    loadServiceItems(value);
  };

  const handleSearch = () => {
    loadCalendarData();
  };

  const handleReset = () => {
    setDepartmentId('');
    setServiceItemId('');
    loadServiceItems();
    loadCalendarData();
  };

  const canCheckIn = (record: DayAppointment): boolean => {
    if (record.status !== 'confirmed') return false;
    if (dayjs(record.appointment_date).isBefore(dayjs().format('YYYY-MM-DD'))) return false;
    return true;
  };

  const canCancel = (record: DayAppointment): boolean => {
    return record.status !== 'cancelled' && record.status !== 'completed';
  };

  const handleCheckIn = async (record: DayAppointment) => {
    setCheckingInId(record.id);
    try {
      const res: any = await api.post(`/appointments/${record.id}/check-in`);
      message.success(`签到取号成功！号票：${res.ticket.ticket_number}`);
      loadDayAppointments(selectedDate);
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingInId('');
    }
  };

  const handleCancel = async (record: DayAppointment) => {
    setCancellingId(record.id);
    try {
      await api.post(`/appointments/${record.id}/cancel`);
      message.success('预约已取消');
      loadDayAppointments(selectedDate);
    } catch (error) {
      console.error(error);
    } finally {
      setCancellingId('');
    }
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setDayAppointmentPage(1);
    setDayModalVisible(true);
  };

  const fetchAllDayAppointments = async (date: string): Promise<DayAppointment[]> => {
    const allResults: DayAppointment[] = [];
    let currentPage = 1;
    const fetchPageSize = 500;
    let hasMore = true;

    while (hasMore) {
      const params: any = { date, page: currentPage, pageSize: fetchPageSize };
      if (departmentId) {
        params.department_id = departmentId;
      }
      if (serviceItemId) {
        params.service_item_id = serviceItemId;
      }
      if (dayStatusFilter) {
        params.status = dayStatusFilter;
      }
      const res: DayAppointmentsResponse = await api.get('/appointments/calendar/day-appointments', { params });
      allResults.push(...res.appointments);
      if (allResults.length >= res.total || res.appointments.length < fetchPageSize) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    return allResults;
  };

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = async () => {
    if (!selectedDate) return;
    setExporting(true);
    try {
      const allAppointments = await fetchAllDayAppointments(selectedDate);
      if (allAppointments.length === 0) {
        message.warning('当前筛选条件下暂无预约数据可导出');
        return;
      }

      const headers = ['预约人', '联系电话', '事项', '科室', '时段', '状态'];
      const rows = allAppointments.map((item) => [
        item.applicant_name || '',
        item.applicant_phone || '',
        item.service_item_name || '',
        item.department_name || '',
        item.time_slot || '',
        AppointmentStatusText[item.status as keyof typeof AppointmentStatusText] || item.status,
      ]);

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ].join('\r\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `预约名单_${selectedDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success(`导出成功，共 ${allAppointments.length} 条预约记录`);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'default',
      confirmed: 'green',
      cancelled: 'red',
      completed: 'blue',
    };
    return colorMap[status] || 'default';
  };

  const calendarDays = useMemo(() => {
    if (!calendarData?.calendar) return [];
    return calendarData.calendar;
  }, [calendarData]);

  const monthDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDay = startOfMonth.day();
    const daysInMonth = endOfMonth.date();

    const days: Array<{ date: dayjs.Dayjs; data?: CalendarDay; isCurrentMonth: boolean }> = [];

    for (let i = 0; i < startDay; i++) {
      const date = startOfMonth.subtract(startDay - i, 'day');
      days.push({ date, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = currentMonth.date(i);
      const dateStr = date.format('YYYY-MM-DD');
      const dayData = calendarDays.find((d) => d.date === dateStr);
      days.push({ date, data: dayData, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = endOfMonth.add(i, 'day');
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth, calendarDays]);

  const prevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const nextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const tableColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      fixed: 'left' as const,
      render: (date: string) => (
        <Space>
          <CalendarOutlined style={{ color: '#1890ff' }} />
          <span>{dayjs(date).format('YYYY-MM-DD')}</span>
        </Space>
      ),
    },
    {
      title: '总号源',
      dataIndex: 'total_count',
      key: 'total_count',
      width: 100,
      sorter: (a: CalendarDay, b: CalendarDay) => a.total_count - b.total_count,
    },
    {
      title: '已预约',
      dataIndex: 'booked_count',
      key: 'booked_count',
      width: 100,
      sorter: (a: CalendarDay, b: CalendarDay) => a.booked_count - b.booked_count,
      render: (count: number, record: CalendarDay) => (
        <span style={{ color: count >= record.total_count && record.total_count > 0 ? '#ff4d4f' : '#faad14' }}>
          {count}
        </span>
      ),
    },
    {
      title: '剩余号源',
      dataIndex: 'remaining_count',
      key: 'remaining_count',
      width: 100,
      sorter: (a: CalendarDay, b: CalendarDay) => a.remaining_count - b.remaining_count,
      render: (count: number) => (
        <span style={{ color: count > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
          {count}
        </span>
      ),
    },
    {
      title: '预约率',
      key: 'rate',
      width: 150,
      render: (_: any, record: CalendarDay) => {
        const percent = record.total_count > 0
          ? Math.round((record.booked_count / record.total_count) * 100)
          : 0;
        return (
          <Progress
            percent={percent}
            size="small"
            status={percent >= 100 ? 'exception' : percent >= 80 ? 'active' : 'normal'}
          />
        );
      },
    },
    {
      title: '服务事项数',
      key: 'item_count',
      width: 110,
      render: (_: any, record: CalendarDay) => record.items.length,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: CalendarDay) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleDateClick(record.date)}
        >
          查看预约
        </Button>
      ),
    },
  ];

  const dayAppointmentColumns = [
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 120,
      render: (name: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '联系电话',
      dataIndex: 'applicant_phone',
      key: 'applicant_phone',
      width: 130,
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
      width: 180,
      render: (name: string, record: DayAppointment) => (
        <Tooltip title={record.service_item_code}>
          {name}
        </Tooltip>
      ),
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '时段',
      dataIndex: 'time_slot',
      key: 'time_slot',
      width: 100,
      render: (slot: string) => slot || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {AppointmentStatusText[status as keyof typeof AppointmentStatusText]}
        </Tag>
      ),
    },
    {
      title: '预约时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: DayAppointment) => (
        <Space size="small">
          {(user?.role === 'window' || user?.role === 'admin') && (
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
          )}
          {(user?.role === 'admin' || user?.role === 'window' || user?.role === 'approver') && (
            <Popconfirm
              title="确定要取消该预约吗？"
              onConfirm={() => handleCancel(record)}
              okText="确定"
              cancelText="取消"
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

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const isToday = (date: dayjs.Dayjs) => date.isSame(dayjs(), 'day');
  const isFuture = (date: dayjs.Dayjs) => date.isAfter(dayjs(), 'day');

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Select
            placeholder="选择科室"
            value={departmentId || undefined}
            onChange={handleDepartmentChange}
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {departments.map((dept) => (
              <Select.Option key={dept.id} value={dept.id}>
                {dept.name}
              </Select.Option>
            ))}
          </Select>
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
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
            查询
          </Button>
          <Button onClick={handleReset} icon={<ReloadOutlined />}>
            重置
          </Button>
          <Space size={4}>
            <Button
              type={viewMode === 'calendar' ? 'primary' : 'default'}
              icon={<CalendarOutlined />}
              onClick={() => setViewMode('calendar')}
            >
              日历视图
            </Button>
            <Button
              type={viewMode === 'table' ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('table')}
            >
              表格视图
            </Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总号源数"
              value={calendarData?.stats?.total_count || 0}
              prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已预约数"
              value={calendarData?.stats?.booked_count || 0}
              prefix={<TeamOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="剩余号源"
              value={calendarData?.stats?.remaining_count || 0}
              prefix={<AppstoreOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务事项数"
              value={calendarData?.stats?.service_item_count || 0}
              prefix={<UnorderedListOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {viewMode === 'calendar' && (
        <Card
          title={
            <Space>
              <Button type="text" onClick={prevMonth} icon={<LeftOutlined />} />
              <Title level={4} style={{ margin: 0 }}>
                {currentMonth.format('YYYY年MM月')}
              </Title>
              <Button type="text" onClick={nextMonth} icon={<RightOutlined />} />
            </Space>
          }
          loading={loading}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {weekDays.map((day, index) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  padding: '12px 0',
                  fontWeight: 500,
                  color: index === 0 || index === 6 ? '#ff4d4f' : '#666',
                  background: '#fafafa',
                  borderRadius: 4,
                }}
              >
                周{day}
              </div>
            ))}
            {monthDays.map((item, index) => {
              const { date, data, isCurrentMonth } = item;
              const dateStr = date.format('YYYY-MM-DD');
              const hasData = !!data;
              const isTodayDate = isToday(date);
              const isFutureDate = isFuture(date);

              let bgColor = '#fff';
              if (isTodayDate) {
                bgColor = '#e6f7ff';
              } else if (!isCurrentMonth) {
                bgColor = '#fafafa';
              }

              const percent = data && data.total_count > 0
                ? Math.round((data.booked_count / data.total_count) * 100)
                : 0;

              const isFull = data && data.remaining_count <= 0;

              return (
                <div
                  key={index}
                  style={{
                    minHeight: 120,
                    padding: 8,
                    border: `1px solid ${isTodayDate ? '#1890ff' : '#f0f0f0'}`,
                    borderRadius: 6,
                    background: bgColor,
                    opacity: isCurrentMonth ? 1 : 0.5,
                    cursor: hasData ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => hasData && handleDateClick(dateStr)}
                  onMouseEnter={(e) => {
                    if (hasData) {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text
                      strong={isTodayDate}
                      style={{
                        color: isTodayDate ? '#1890ff' : isCurrentMonth ? '#333' : '#ccc',
                        fontSize: 14,
                      }}
                    >
                      {date.date()}
                    </Text>
                    {isTodayDate && <Tag color="blue" style={{ margin: 0 }}>今天</Tag>}
                    {isFull && <Tag color="red" style={{ margin: 0 }}>已满</Tag>}
                  </div>
                  {hasData && data ? (
                    <>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        余 <span style={{ color: isFull ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>{data.remaining_count}</span> / {data.total_count}
                      </div>
                      <Progress
                        percent={percent}
                        size="small"
                        showInfo={false}
                        status={isFull ? 'exception' : 'active'}
                      />
                      {data.items.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#999' }}>
                          {data.items.length} 个事项
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: '#ccc', marginTop: 20, textAlign: 'center' }}>
                      暂无号源
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {viewMode === 'table' && (
        <Card title="号源概览" loading={loading}>
          <Table
            columns={tableColumns}
            dataSource={calendarDays}
            rowKey="date"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 800 }}
          />
        </Card>
      )}

      <Modal
        title={`${dayjs(selectedDate).format('YYYY年MM月DD日')} 预约名单`}
        open={dayModalVisible}
        onCancel={() => setDayModalVisible(false)}
        footer={[
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            loading={exporting}
            disabled={dayAppointmentTotal === 0}
          >
            导出预约名单
          </Button>,
          <Button key="close" onClick={() => setDayModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1100}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Statistic
                title="总预约数"
                value={dayAppointmentTotal}
                prefix={<CalendarOutlined />}
              />
            </Col>
            <Col span={16} style={{ textAlign: 'right' }}>
              <Select
                placeholder="按状态筛选"
                value={dayStatusFilter || undefined}
                onChange={(value) => {
                  setDayStatusFilter(value || '');
                  setDayAppointmentPage(1);
                }}
                style={{ width: 160 }}
                allowClear
              >
                <Select.Option value="pending">待确认</Select.Option>
                <Select.Option value="confirmed">已确认</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
                <Select.Option value="cancelled">已取消</Select.Option>
              </Select>
            </Col>
          </Row>
        </div>
        <Table
          columns={dayAppointmentColumns}
          dataSource={dayAppointments}
          rowKey="id"
          loading={dayAppointmentsLoading}
          pagination={{
            current: dayAppointmentPage,
            pageSize: dayAppointmentPageSize,
            total: dayAppointmentTotal,
            onChange: setDayAppointmentPage,
            showSizeChanger: false,
          }}
          scroll={{ x: 1050 }}
        />
      </Modal>
    </div>
  );
}

export default AppointmentCalendar;
