import { Card, Table, Button, Select, Input, Modal, Tag, message, Space, Row, Col, Statistic, Tooltip, InputNumber, Form, Descriptions } from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  BellOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department } from '../../types';
import { CaseStatusText } from '../../types';
import { useAuthStore } from '../../store/auth';

interface WarningCase extends Case {
  days_remaining: number;
  hours_remaining: number;
  warning_level: string;
}

interface WarningStats {
  overdue: number;
  upcoming: number;
  completed_on_time: number;
  completed_overdue: number;
  total_warnings: number;
  department_stats: Array<{
    department_id: string;
    department_name: string;
    overdue_count: number;
    upcoming_count: number;
    on_time_count: number;
    overdue_completed_count: number;
  }>;
}

function OverdueWarningCenter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [cases, setCases] = useState<WarningCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [warningType, setWarningType] = useState<string>('all');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [warningDays, setWarningDays] = useState<number>(3);
  const [stats, setStats] = useState<WarningStats>({
    overdue: 0,
    upcoming: 0,
    completed_on_time: 0,
    completed_overdue: 0,
    total_warnings: 0,
    department_stats: [],
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<WarningCase | null>(null);
  const [remindVisible, setRemindVisible] = useState(false);
  const [remindLoading, setRemindLoading] = useState(false);
  const [remindForm] = Form.useForm();

  const isAdmin = user?.role === 'admin';
  const isApprover = user?.role === 'approver';

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadStats();
    loadCases();
  }, [page, pageSize, warningDays]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const params: any = { days: warningDays };
      if (departmentId && isAdmin) params.department_id = departmentId;
      const res: any = await api.get('/cases/warnings/stats', { params });
      setStats(res || {
        overdue: 0,
        upcoming: 0,
        completed_on_time: 0,
        completed_overdue: 0,
        total_warnings: 0,
        department_stats: [],
      });
    } catch (error) {
      console.error(error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
        days: warningDays,
      };
      if (warningType && warningType !== 'all') params.warning_type = warningType;
      if (departmentId && isAdmin) params.department_id = departmentId;
      if (keyword) params.keyword = keyword;

      const res: any = await api.get('/cases/warnings/list', { params });
      setCases(res.cases || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadStats();
    loadCases();
  };

  const handleReset = () => {
    setWarningType('all');
    setDepartmentId('');
    setKeyword('');
    setWarningDays(3);
    setPage(1);
    setTimeout(() => {
      loadStats();
      loadCases();
    }, 0);
  };

  const handleViewDetail = async (caseItem: WarningCase) => {
    setCurrentCase(caseItem);
    setDetailVisible(true);
  };

  const handleRemind = (caseItem: WarningCase) => {
    setCurrentCase(caseItem);
    remindForm.resetFields();
    setRemindVisible(true);
  };

  const handleConfirmRemind = async () => {
    if (!currentCase) return;
    try {
      const values = await remindForm.validateFields();
      setRemindLoading(true);
      await api.post(`/cases/warnings/${currentCase.id}/remind`, {
        remark: values.remark,
      });
      message.success('催办通知已发送');
      setRemindVisible(false);
      loadCases();
      loadStats();
    } catch (error) {
      console.error(error);
    } finally {
      setRemindLoading(false);
    }
  };

  const getWarningTag = (record: WarningCase) => {
    if (record.status === 'completed') {
      if (record.warning_level === 'on_time') {
        return <Tag color="success">按期办结</Tag>;
      }
      return <Tag color="default">超期办结</Tag>;
    }
    if (record.status === 'rejected') {
      return <Tag color="default">已驳回</Tag>;
    }
    switch (record.warning_level) {
      case 'overdue':
        return <Tag color="red">已超期</Tag>;
      case 'urgent':
        return <Tag color="orange">紧急</Tag>;
      case 'warning':
        return <Tag color="gold">即将超期</Tag>;
      default:
        return <Tag color="blue">正常</Tag>;
    }
  };

  const getRemainingText = (record: WarningCase) => {
    if (record.status === 'completed' || record.status === 'rejected') {
      return '-';
    }
    if (record.days_remaining < 0) {
      return <span style={{ color: '#ff4d4f' }}>超期 {Math.abs(record.days_remaining)} 天</span>;
    }
    if (record.days_remaining === 0) {
      const hours = record.hours_remaining;
      if (hours < 0) {
        return <span style={{ color: '#ff4d4f' }}>超期 {Math.abs(hours)} 小时</span>;
      }
      return <span style={{ color: '#fa8c16' }}>剩余 {hours} 小时</span>;
    }
    return <span style={{ color: '#faad14' }}>剩余 {record.days_remaining} 天</span>;
  };

  const columns = [
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 180,
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace' }}>{text}</span>
      ),
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100,
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
      hidden: !isAdmin,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag>{CaseStatusText[status as keyof typeof CaseStatusText] || status}</Tag>
      ),
    },
    {
      title: '预警状态',
      dataIndex: 'warning_level',
      key: 'warning_level',
      width: 100,
      render: (_: any, record: WarningCase) => getWarningTag(record),
    },
    {
      title: '剩余时间',
      key: 'remaining',
      width: 120,
      render: (_: any, record: WarningCase) => getRemainingText(record),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 170,
      render: (deadline: string) => dayjs(deadline).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '当前处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: WarningCase) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {(record.status !== 'completed' && record.status !== 'rejected') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<BellOutlined />}
              onClick={() => handleRemind(record)}
            >
              催办
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const warningTypeOptions = [
    { value: 'all', label: '全部预警' },
    { value: 'overdue', label: '已超期' },
    { value: 'upcoming', label: '即将超期' },
    { value: 'completed_on_time', label: '按期办结' },
    { value: 'completed_overdue', label: '超期办结' },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>超期预警中心</span>
          </Space>
        }
        extra={
          <Space>
            <span style={{ color: '#666', fontSize: 12 }}>预警提前天数：</span>
            <InputNumber
              min={1}
              max={30}
              value={warningDays}
              onChange={(value) => setWarningDays(value || 3)}
              size="small"
              style={{ width: 80 }}
            />
            <span style={{ color: '#666', fontSize: 12 }}>天</span>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => {
                loadStats();
                loadCases();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" loading={statsLoading}>
              <Statistic
                title="已超期"
                value={stats.overdue}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" loading={statsLoading}>
              <Statistic
                title="即将超期"
                value={stats.upcoming}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" loading={statsLoading}>
              <Statistic
                title="按期办结"
                value={stats.completed_on_time}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" loading={statsLoading}>
              <Statistic
                title="超期办结"
                value={stats.completed_overdue}
                valueStyle={{ color: '#8c8c8c' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {isAdmin && stats.department_stats.length > 0 && (
          <Card size="small" title="各科室预警统计" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              dataSource={stats.department_stats}
              rowKey="department_id"
              pagination={false}
              columns={[
                {
                  title: '科室名称',
                  dataIndex: 'department_name',
                  key: 'department_name',
                },
                {
                  title: '已超期',
                  dataIndex: 'overdue_count',
                  key: 'overdue_count',
                  width: 100,
                  render: (count: number) => (
                    <span style={{ color: count > 0 ? '#ff4d4f' : '#666' }}>
                      {count}
                    </span>
                  ),
                },
                {
                  title: '即将超期',
                  dataIndex: 'upcoming_count',
                  key: 'upcoming_count',
                  width: 100,
                  render: (count: number) => (
                    <span style={{ color: count > 0 ? '#fa8c16' : '#666' }}>
                      {count}
                    </span>
                  ),
                },
                {
                  title: '按期办结',
                  dataIndex: 'on_time_count',
                  key: 'on_time_count',
                  width: 100,
                  render: (count: number) => (
                    <span style={{ color: '#52c41a' }}>{count}</span>
                  ),
                },
                {
                  title: '超期办结',
                  dataIndex: 'overdue_completed_count',
                  key: 'overdue_completed_count',
                  width: 100,
                  render: (count: number) => (
                    <span style={{ color: '#8c8c8c' }}>{count}</span>
                  ),
                },
              ]}
            />
          </Card>
        )}

        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              value={warningType}
              onChange={setWarningType}
              style={{ width: 150 }}
              options={warningTypeOptions}
              allowClear
              placeholder="预警类型"
            />
            {isAdmin && (
              <Select
                value={departmentId}
                onChange={setDepartmentId}
                style={{ width: 180 }}
                placeholder="选择科室"
                allowClear
                options={departments.map(d => ({
                  value: d.id,
                  label: d.name,
                }))}
              />
            )}
            <Input
              placeholder="搜索办件编号/申请人/服务事项"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 280 }}
              prefix={<SearchOutlined />}
              onPressEnter={handleSearch}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Card>

        <Table
          loading={loading}
          dataSource={cases}
          rowKey="id"
          columns={columns}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      <Modal
        title="办件详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {currentCase && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="办件编号" span={2}>
                <span style={{ fontFamily: 'monospace' }}>
                  {currentCase.case_number}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="服务事项">
                {currentCase.service_item_name}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag>{CaseStatusText[currentCase.status as keyof typeof CaseStatusText] || currentCase.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="预警状态">
                {getWarningTag(currentCase)}
              </Descriptions.Item>
              <Descriptions.Item label="剩余时间">
                {getRemainingText(currentCase)}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {currentCase.applicant_name}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {currentCase.user_phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="所属科室">
                {currentCase.department_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="办理窗口">
                {currentCase.window_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前处理人">
                {currentCase.handler_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间" span={2}>
                {dayjs(currentCase.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="截止时间" span={2}>
                <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>
                  {dayjs(currentCase.deadline).format('YYYY-MM-DD HH:mm:ss')}
                </span>
              </Descriptions.Item>
              {currentCase.completed_at && (
                <Descriptions.Item label="办结时间" span={2}>
                  {dayjs(currentCase.completed_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title="催办确认"
        open={remindVisible}
        onCancel={() => setRemindVisible(false)}
        confirmLoading={remindLoading}
        onOk={handleConfirmRemind}
        okText="确认催办"
        okButtonProps={{ danger: true }}
      >
        {currentCase && (
          <div>
            <p>
              确定要对办件 <strong>{currentCase.case_number}</strong> 发送催办通知吗？
            </p>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
              催办通知将发送给当前处理人及本科室所有审批人员。
            </p>
            <Form form={remindForm} layout="vertical">
              <Form.Item
                name="remark"
                label="催办备注"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="请输入催办备注（选填）"
                  maxLength={200}
                  showCount
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default OverdueWarningCenter;
