import { Card, Table, Tag, Button, Select, Space, Modal, message, Spin } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { Appointment } from '../../types';
import { AppointmentStatusText } from '../../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { confirm } = Modal;

function CitizenAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    loadAppointments();
  }, [status, pagination.current, pagination.pageSize]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/appointments/my', {
        params: {
          status,
          page: pagination.current,
          pageSize: pagination.pageSize,
        },
      });
      setAppointments(res.appointments || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (id: string) => {
    confirm({
      title: '确认取消预约',
      icon: <ExclamationCircleOutlined />,
      content: '您确定要取消此预约吗？',
      okText: '确认取消',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        try {
          await api.post(`/appointments/${id}/cancel`);
          message.success('预约已取消');
          loadAppointments();
        } catch (error) {
          console.error(error);
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      confirmed: 'green',
      cancelled: 'default',
      completed: 'success',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: '预约号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text.slice(0, 8)}...</span>,
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
    },
    {
      title: '预约日期',
      dataIndex: 'appointment_date',
      key: 'appointment_date',
      render: (date: string, record: Appointment) => (
        <div>
          <div>{dayjs(date).format('YYYY-MM-DD')}</div>
          {record.time_slot && <div style={{ fontSize: 12, color: '#999' }}>{record.time_slot}</div>}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {AppointmentStatusText[status as keyof typeof AppointmentStatusText]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Appointment) => (
        <Space>
          {['pending', 'confirmed'].includes(record.status) && (
          <Button type="link" danger size="small" onClick={() => handleCancel(record.id)}>
            取消预约
          </Button>
        )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="我的预约"
        extra={
          <Space>
            <Select
              placeholder="按状态筛选"
              style={{ width: 150 }}
              value={status}
              onChange={setStatus}
              allowClear
            >
              <Option value="pending">待确认</Option>
              <Option value="confirmed">已确认</Option>
              <Option value="cancelled">已取消</Option>
              <Option value="completed">已完成</Option>
            </Select>
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={appointments}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
            }}
          />
        </Spin>
      </Card>
    </div>
  );
}

export default CitizenAppointments;
