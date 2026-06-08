import { Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { AlertOutlined, BellOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import { useAuthStore } from '../../store/auth';
import type { Case, CaseFlow, CaseMaterial, Department } from '../../types';
import { CaseStatusText } from '../../types';

const { TextArea } = Input;

type WarningStatus = 'upcoming' | 'overdue' | 'on_time';
type WarningCase = Case & {
  warning_status: WarningStatus;
  remaining_hours?: number;
};
type WarningQuery = {
  departmentId?: string;
  warningStatus?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

const WarningStatusText: Record<WarningStatus, string> = {
  upcoming: '即将超期',
  overdue: '已超期',
  on_time: '按期办结',
};

const WarningStatusColor: Record<WarningStatus, string> = {
  upcoming: 'orange',
  overdue: 'red',
  on_time: 'green',
};

function OverdueWarningCenter() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<WarningCase[]>([]);
  const [stats, setStats] = useState({ upcoming: 0, overdue: 0, on_time: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [warningStatus, setWarningStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [remindVisible, setRemindVisible] = useState(false);
  const [remindSubmitting, setRemindSubmitting] = useState(false);
  const [remindForm] = Form.useForm();

  useEffect(() => {
    if (isAdmin) {
      loadDepartments();
    }
  }, [isAdmin]);

  useEffect(() => {
    loadWarnings();
    loadStats();
  }, [page, pageSize]);

  const buildParams = (query: WarningQuery = {}) => {
    const nextDepartmentId = query.departmentId ?? departmentId;
    const nextWarningStatus = query.warningStatus ?? warningStatus;
    const nextKeyword = query.keyword ?? keyword;
    const params: any = {
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
    };
    if (isAdmin && nextDepartmentId) params.department_id = nextDepartmentId;
    if (nextWarningStatus) params.warning_status = nextWarningStatus;
    if (nextKeyword) params.keyword = nextKeyword;
    return params;
  };

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadStats = async (query: WarningQuery = {}) => {
    try {
      const params: any = {};
      const nextDepartmentId = query.departmentId ?? departmentId;
      if (isAdmin && nextDepartmentId) params.department_id = nextDepartmentId;
      const res: any = await api.get('/cases/warnings/stats', { params });
      setStats({
        upcoming: res.upcoming || 0,
        overdue: res.overdue || 0,
        on_time: res.on_time || 0,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadWarnings = async (query: WarningQuery = {}) => {
    setLoading(true);
    try {
      const res: any = await api.get('/cases/warnings/list', { params: buildParams(query) });
      setCases(res.cases || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const query = { page: 1 };
    setPage(1);
    loadWarnings(query);
    loadStats();
  };

  const handleReset = () => {
    const query = { departmentId: '', warningStatus: '', keyword: '', page: 1 };
    setDepartmentId('');
    setWarningStatus('');
    setKeyword('');
    setPage(1);
    loadWarnings(query);
    loadStats(query);
  };

  const handleViewDetail = async (caseItem: Case) => {
    setCurrentCase(caseItem);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res: any = await api.get(`/cases/${caseItem.id}`);
      setCaseMaterials(res.materials || []);
      setCaseFlows(res.flows || []);
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openRemind = (caseItem: Case) => {
    setCurrentCase(caseItem);
    remindForm.setFieldsValue({
      content: `办件${caseItem.case_number}即将或已经超期，请尽快处理。`,
    });
    setRemindVisible(true);
  };

  const handleRemindSubmit = async () => {
    try {
      const values = await remindForm.validateFields();
      setRemindSubmitting(true);
      const res: any = await api.post(`/cases/warnings/${currentCase?.id}/remind`, values);
      message.success(res.message || '催办通知已发送');
      setRemindVisible(false);
      remindForm.resetFields();
    } catch (error) {
      console.error(error);
    } finally {
      setRemindSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      submitted: 'blue',
      material_reviewing: 'cyan',
      material_correction: 'orange',
      accepting: 'purple',
      reviewing: 'geekblue',
      cross_department: 'gold',
      approved: 'green',
      rejected: 'red',
      completed: 'green',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: '预警状态',
      dataIndex: 'warning_status',
      key: 'warning_status',
      width: 110,
      render: (status: WarningStatus) => (
        <Tag color={WarningStatusColor[status]}>
          {WarningStatusText[status] || status}
        </Tag>
      ),
    },
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 170,
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    { title: '服务事项', dataIndex: 'service_item_name', key: 'service_item_name', width: 160 },
    { title: '申请人', dataIndex: 'applicant_name', key: 'applicant_name', width: 100 },
    { title: '所属科室', dataIndex: 'department_name', key: 'department_name', width: 130 },
    {
      title: '办件状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {CaseStatusText[status as keyof typeof CaseStatusText] || status}
        </Tag>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 170,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '剩余/超期',
      dataIndex: 'remaining_hours',
      key: 'remaining_hours',
      width: 110,
      render: (_: any, record: any) => {
        if (record.warning_status === 'on_time') return <span style={{ color: '#52c41a' }}>按期办结</span>;
        const hours = Number(record.remaining_hours || 0);
        if (hours < 0) return <span style={{ color: '#ff4d4f' }}>超期{Math.abs(hours)}小时</span>;
        return <span style={{ color: '#faad14' }}>剩余{hours}小时</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right' as const,
      render: (_: any, record: WarningCase) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.warning_status !== 'on_time' && (
            <Button type="link" size="small" icon={<BellOutlined />} onClick={() => openRemind(record)}>
              催办
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="即将超期" value={stats.upcoming} prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已超期" value={stats.overdue} prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="按期办结" value={stats.on_time} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input
            placeholder="搜索办件编号/申请人/事项"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            placeholder="预警状态"
            value={warningStatus || undefined}
            onChange={setWarningStatus}
            allowClear
            style={{ width: 150 }}
            options={[
              { label: '即将超期', value: 'upcoming' },
              { label: '已超期', value: 'overdue' },
              { label: '按期办结', value: 'on_time' },
            ]}
          />
          {isAdmin && (
            <Select
              placeholder="选择科室"
              value={departmentId || undefined}
              onChange={setDepartmentId}
              allowClear
              showSearch
              optionFilterProp="children"
              style={{ width: 180 }}
            >
              {departments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          )}
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Card title="超期预警列表">
        <Table
          columns={columns}
          dataSource={cases}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>

      <Modal
        title="办件详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={800}
        destroyOnClose
      >
        {currentCase && (
          <div>
            <Descriptions title="基本信息" bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="办件编号">{currentCase.case_number}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(currentCase.status)}>
                  {CaseStatusText[currentCase.status as keyof typeof CaseStatusText]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="服务事项">{currentCase.service_item_name}</Descriptions.Item>
              <Descriptions.Item label="所属科室">{currentCase.department_name}</Descriptions.Item>
              <Descriptions.Item label="申请人">{currentCase.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{currentCase.applicant_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前处理人">{currentCase.handler_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="截止时间">
                {currentCase.deadline ? dayjs(currentCase.deadline).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {caseMaterials.length > 0 && (
              <Table
                size="small"
                title={() => '材料清单'}
                dataSource={caseMaterials}
                rowKey="id"
                columns={[
                  { title: '材料名称', dataIndex: 'name', key: 'name' },
                  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
                  { title: '审核意见', dataIndex: 'review_comment', key: 'review_comment' },
                ]}
                pagination={false}
                style={{ marginBottom: 16 }}
              />
            )}

            {caseFlows.length > 0 && (
              <Table
                size="small"
                title={() => '办理流程'}
                dataSource={caseFlows}
                rowKey="id"
                columns={[
                  { title: '操作', dataIndex: 'action', key: 'action', width: 100 },
                  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
                  { title: '操作人', dataIndex: 'from_user_name', key: 'from_user_name', width: 120 },
                  { title: '意见', dataIndex: 'comment', key: 'comment' },
                  {
                    title: '时间',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    width: 160,
                    render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
                  },
                ]}
                pagination={false}
                loading={detailLoading}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="发送催办通知"
        open={remindVisible}
        onCancel={() => setRemindVisible(false)}
        onOk={handleRemindSubmit}
        confirmLoading={remindSubmitting}
        okText="发送催办"
        destroyOnClose
      >
        <Form form={remindForm} layout="vertical">
          <Form.Item
            name="content"
            label="催办内容"
            rules={[{ required: true, message: '请输入催办内容' }]}
          >
            <TextArea rows={4} maxLength={200} showCount />
          </Form.Item>
        </Form>
        <AlertOutlined style={{ color: '#faad14', marginRight: 8 }} />
        <span style={{ color: '#666' }}>催办通知将写入相关工作人员的消息中心。</span>
      </Modal>
    </div>
  );
}

export default OverdueWarningCenter;
