import { Card, Table, Button, Input, Modal, Form, Input as AntInput, Tag, message, Space, Descriptions, Row, Col, Statistic, List, Select, Tabs, Badge, Tooltip } from 'antd';
import { SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined, SwapOutlined, FileTextOutlined, ClockCircleOutlined, PrinterOutlined, ImportOutlined, RollbackOutlined, SendOutlined, UserOutlined, TeamOutlined, HistoryOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department, CaseMaterial, CaseFlow, ServiceItemMaterial, User } from '../../types';
import { CaseStatusText, CaseFlowActionText } from '../../types';
import { getCaseMaterialList, hasCaseMaterials } from '../../utils/materials';
import CaseReceipt from '../../components/CaseReceipt';

const { TextArea } = AntInput;

type TabKey = 'all' | 'pending_receive' | 'mine' | 'initiated';

function CaseCollaboration() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiveForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [approvers, setApprovers] = useState<User[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending_receive: 0,
    mine: 0,
    initiated: 0,
  });

  useEffect(() => {
    loadDepartments();
    loadStats();
  }, []);

  useEffect(() => {
    loadCases();
  }, [activeTab, page, pageSize]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadStats = async () => {
    try {
      const res: any = await api.get('/cases/collaboration/stats');
      setStats(res || { total: 0, pending_receive: 0, mine: 0, initiated: 0 });
    } catch (error) {
      console.error(error);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: any = {
        type: activeTab,
        page,
        pageSize,
      };
      if (keyword) params.keyword = keyword;

      const res: any = await api.get('/cases/collaboration/todo', { params });
      setCases(res.cases || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    loadCases();
  };

  const handleReset = () => {
    setKeyword('');
    setPage(1);
    loadCases();
  };

  const handleViewDetail = async (caseItem: Case) => {
    setCurrentCase(caseItem);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res: any = await api.get(`/cases/${caseItem.id}`);
      if (res.case) {
        setCurrentCase(res.case);
      }
      setCaseMaterials(res.materials || []);
      setCaseFlows(res.flows || []);
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewReceipt = (caseItem: Case) => {
    setCurrentCase(caseItem);
    setReceiptVisible(true);
  };

  const handleReceive = (caseItem: Case) => {
    setCurrentCase(caseItem);
    receiveForm.resetFields();
    setReceiveModalVisible(true);
  };

  const handleReceiveSubmit = async () => {
    try {
      const values = await receiveForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/receive`, values);
      message.success('接收成功');
      setReceiveModalVisible(false);
      loadCases();
      loadStats();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = (caseItem: Case) => {
    setCurrentCase(caseItem);
    returnForm.resetFields();
    setReturnModalVisible(true);
  };

  const handleReturnSubmit = async () => {
    try {
      const values = await returnForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/return`, values);
      message.success('退回成功');
      setReturnModalVisible(false);
      loadCases();
      loadStats();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = (caseItem: Case) => {
    setCurrentCase(caseItem);
    completeForm.resetFields();
    setCompleteModalVisible(true);
  };

  const handleCompleteSubmit = async () => {
    try {
      const values = await completeForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/collaborate-complete`, values);
      message.success('协同办结成功');
      setCompleteModalVisible(false);
      loadCases();
      loadStats();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = (caseItem: Case) => {
    setCurrentCase(caseItem);
    transferForm.resetFields();
    setApprovers([]);
    setTransferModalVisible(true);
  };

  const handleTransferDepartmentChange = async (departmentId: string) => {
    if (departmentId) {
      try {
        const res: any = await api.get(`/cases/department/${departmentId}/approvers`);
        setApprovers(res.users || []);
      } catch (error) {
        console.error(error);
      }
    } else {
      setApprovers([]);
    }
  };

  const handleTransferSubmit = async () => {
    try {
      const values = await transferForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/transfer`, values);
      message.success('转交成功');
      setTransferModalVisible(false);
      loadCases();
      loadStats();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'default',
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

  const renderFlowInfo = (record: Case) => {
    const fromDept = record.from_department_name || '-';
    const fromUser = record.transfer_from_user_name || '';
    const transferTime = record.transfer_time ? dayjs(record.transfer_time).format('MM-DD HH:mm') : '-';
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <TeamOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#595959' }}>来源：{fromDept}</span>
        </div>
        {fromUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <UserOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
            <span style={{ fontSize: 12, color: '#595959' }}>转交人：{fromUser}</span>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#595959' }}>{transferTime}</span>
        </div>
      </div>
    );
  };

  const renderHandler = (text: string) => {
    if (text) {
      return (
        <Tag color="green" icon={<UserOutlined />} style={{ margin: 0 }}>
          {text}
        </Tag>
      );
    }
    return <Badge status="warning" text="待接收" />;
  };

  const renderAction = (record: Case) => {
    const isMine = !!record.current_handler_id;
    const isInitiatedTab = activeTab === 'initiated';

    return (
      <Space size="small" wrap>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
        {!isMine && !isInitiatedTab && (
          <Button type="primary" size="small" ghost icon={<ImportOutlined />} onClick={() => handleReceive(record)}>
            接收
          </Button>
        )}
        {isMine && !isInitiatedTab && (
          <>
            <Button type="link" size="small" danger icon={<RollbackOutlined />} onClick={() => handleReturn(record)}>
              退回
            </Button>
            <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleComplete(record)}>
              办结
            </Button>
          </>
        )}
        {!isInitiatedTab && (
          <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleTransfer(record)}>
            转交
          </Button>
        )}
        {isInitiatedTab && (
          <Tooltip title="在目标科室办理中，请等待办理结果">
            <Tag color="processing" icon={<ClockCircleOutlined />} style={{ margin: 0 }}>
              办理中
            </Tag>
          </Tooltip>
        )}
      </Space>
    );
  };

  const columns = [
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 160,
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
      width: 150,
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100,
    },
    {
      title: '流转信息',
      key: 'flow_info',
      width: 200,
      render: renderFlowInfo,
    },
    {
      title: '当前科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
      render: (text: string) => (
        <Tag color="blue" icon={<TeamOutlined />} style={{ margin: 0 }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '当前处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 110,
      render: renderHandler,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {CaseStatusText[status as keyof typeof CaseStatusText] || status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 340,
      fixed: 'right' as const,
      render: renderAction,
    },
  ];

  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          <FileTextOutlined /> 全部协同
          <Badge count={stats.total} style={{ marginLeft: 8 }} />
        </span>
      ),
    },
    {
      key: 'pending_receive',
      label: (
        <span>
          <ClockCircleOutlined /> 待我接收
          <Badge count={stats.pending_receive} style={{ marginLeft: 8 }} />
        </span>
      ),
    },
    {
      key: 'mine',
      label: (
        <span>
          <UserOutlined /> 我办理的
          <Badge count={stats.mine} style={{ marginLeft: 8 }} />
        </span>
      ),
    },
    {
      key: 'initiated',
      label: (
        <span>
          <HistoryOutlined /> 我发起的
          <Badge count={stats.initiated} style={{ marginLeft: 8 }} />
        </span>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="全部协同办件"
              value={stats.total}
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待接收"
              value={stats.pending_receive}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="我办理的"
              value={stats.mine}
              prefix={<UserOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="我发起的"
              value={stats.initiated}
              prefix={<HistoryOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input
            placeholder="搜索办件编号/申请人"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 220 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card
        title={
          <Tabs
            activeKey={activeTab}
            items={tabItems}
            onChange={handleTabChange}
            size="large"
            style={{ marginBottom: -16, marginTop: -8 }}
          />
        }
        headStyle={{ paddingBottom: 0 }}
        bodyStyle={{ paddingTop: 0 }}
      >
        <Table
          columns={columns}
          dataSource={cases}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
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
          <Button key="receipt" icon={<PrinterOutlined />} onClick={() => {
            setDetailVisible(false);
            if (currentCase) {
              handleViewReceipt(currentCase);
            }
          }}>
            查看回执
          </Button>,
        ]}
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
              <Descriptions.Item label="当前处理人">{currentCase.handler_name || '待接收'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(currentCase.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              {currentCase.from_department_name && (
                <Descriptions.Item label="来源科室" span={2}>
                  <Tag color="purple" icon={<TeamOutlined />}>{currentCase.from_department_name}</Tag>
                  {currentCase.transfer_from_user_name ? `  转交人：${currentCase.transfer_from_user_name}` : ''}
                </Descriptions.Item>
              )}
              {currentCase.transfer_comment && (
                <Descriptions.Item label="转交说明" span={2}>
                  {currentCase.transfer_comment}
                </Descriptions.Item>
              )}
            </Descriptions>

            {currentCase && hasCaseMaterials(currentCase) && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>所需材料</h4>
                <List
                  size="small"
                  dataSource={getCaseMaterialList(currentCase)}
                  renderItem={(item: ServiceItemMaterial) => (
                    <List.Item key={item.id}>
                      <List.Item.Meta
                        avatar={
                          item.is_required ? (
                            <Tag color="red" style={{ margin: 0 }}>
                              必填
                            </Tag>
                          ) : (
                            <Tag color="default" style={{ margin: 0 }}>
                              选填
                            </Tag>
                          )
                        }
                        title={item.name}
                        description={
                          <div style={{ fontSize: 12 }}>
                            {item.description ? <div style={{ marginBottom: 2 }}>{item.description}</div> : null}
                            {item.example ? (
                              <div style={{ color: '#999' }}>
                                <span style={{ color: '#1890ff' }}>示例：</span>
                                {item.example}
                              </div>
                            ) : null}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}

            {caseMaterials.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>已提交材料</h4>
                <Table
                  size="small"
                  dataSource={caseMaterials}
                  rowKey="id"
                  columns={[
                    { title: '材料名称', dataIndex: 'name', key: 'name' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 100,
                      render: (s: string) => {
                        const map: Record<string, string> = {
                          pending: '待审核',
                          approved: '通过',
                          rejected: '不通过',
                        };
                        return <Tag>{map[s] || s}</Tag>;
                      },
                    },
                    { title: '审核意见', dataIndex: 'review_comment', key: 'review_comment' },
                  ]}
                  pagination={false}
                />
              </div>
            )}

            {caseFlows.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 8 }}>办理流程</h4>
                <Table
                  size="small"
                  dataSource={caseFlows}
                  rowKey="id"
                  columns={[
                    {
                      title: '操作',
                      dataIndex: 'action',
                      key: 'action',
                      width: 100,
                      render: (action: string) => CaseFlowActionText[action] || action,
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 120,
                      render: (status: string) => CaseStatusText[status as keyof typeof CaseStatusText] || status,
                    },
                    {
                      title: '流转',
                      key: 'flow',
                      width: 200,
                      render: (_: any, record: CaseFlow) => (
                        <div>
                          <div>{record.from_department_name || '-'}</div>
                          <div style={{ color: '#1890ff', fontSize: 12 }}>→</div>
                          <div>{record.to_department_name || '-'}</div>
                        </div>
                      ),
                    },
                    { title: '操作人', dataIndex: 'from_user_name', key: 'from_user_name', width: 100 },
                    { title: '意见', dataIndex: 'comment', key: 'comment' },
                    {
                      title: '时间',
                      dataIndex: 'created_at',
                      key: 'created_at',
                      width: 160,
                      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm'),
                    },
                  ]}
                  pagination={false}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="接收协同办件"
        open={receiveModalVisible}
        onCancel={() => setReceiveModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setReceiveModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleReceiveSubmit}>
            确认接收
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={receiveForm} layout="vertical">
          <Form.Item name="comment" label="接收意见">
            <TextArea rows={4} placeholder="请输入接收意见（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="退回协同办件"
        open={returnModalVisible}
        onCancel={() => setReturnModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setReturnModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" danger loading={submitting} onClick={handleReturnSubmit}>
            确认退回
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={returnForm} layout="vertical">
          <Form.Item
            name="comment"
            label="退回原因"
            rules={[{ required: true, message: '请输入退回原因' }]}
          >
            <TextArea rows={4} placeholder="请输入退回原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="协同办结"
        open={completeModalVisible}
        onCancel={() => setCompleteModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setCompleteModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleCompleteSubmit}>
            确认办结
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical">
          <Form.Item
            name="comment"
            label="办结意见"
            rules={[{ required: true, message: '请输入办结意见' }]}
          >
            <TextArea rows={4} placeholder="请输入办结意见" />
          </Form.Item>
          <Form.Item name="result" label="办理结果">
            <TextArea rows={3} placeholder="请输入办理结果说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="跨科室转交"
        open={transferModalVisible}
        onCancel={() => setTransferModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setTransferModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleTransferSubmit}>
            确认转交
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item
            name="to_department_id"
            label="目标科室"
            rules={[{ required: true, message: '请选择目标科室' }]}
          >
            <Select
              placeholder="请选择目标科室"
              showSearch
              optionFilterProp="children"
              onChange={handleTransferDepartmentChange}
            >
              {departments
                .filter((d) => d.id !== currentCase?.department_id)
                .map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="to_user_id" label="指定审批人（可选）">
            <Select
              placeholder="请选择指定审批人（可选）"
              showSearch
              optionFilterProp="children"
              disabled={approvers.length === 0}
            >
              {approvers.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="comment" label="转交说明">
            <TextArea rows={4} placeholder="请输入转交说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="办件受理回执"
        open={receiptVisible}
        onCancel={() => setReceiptVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {currentCase ? (
          <CaseReceipt
            caseData={currentCase}
            onClose={() => setReceiptVisible(false)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

export default CaseCollaboration;
