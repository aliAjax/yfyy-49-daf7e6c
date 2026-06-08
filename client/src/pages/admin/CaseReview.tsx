import { Card, Table, Button, Select, Input, Modal, Form, Input as AntInput, Tag, message, Space, Descriptions, Row, Col, Statistic, List, Tooltip, Alert } from 'antd';
import { SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined, SwapOutlined, FileTextOutlined, ClockCircleOutlined, PrinterOutlined, EditOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department, CaseMaterial, CaseFlow, ServiceItemMaterial, User } from '../../types';
import { CaseStatusText, CaseFlowActionText, CaseMaterialStatusText, CaseMaterialStatusColor } from '../../types';
import { getCaseMaterialList, hasCaseMaterials } from '../../utils/materials';
import CaseReceipt from '../../components/CaseReceipt';

const { TextArea } = AntInput;

function CaseReview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [serviceItemId, setServiceItemId] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [pendingCount, setPendingCount] = useState(0);
  const [approvers, setApprovers] = useState<User[]>([]);
  const [materialReviewModalVisible, setMaterialReviewModalVisible] = useState(false);
  const [currentReviewMaterial, setCurrentReviewMaterial] = useState<CaseMaterial | null>(null);
  const [reviewForm] = Form.useForm();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    loadDepartments();
    loadCases();
  }, [page, pageSize]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: any = {
        status: 'reviewing',
        page,
        pageSize,
      };
      if (keyword) params.keyword = keyword;
      if (serviceItemId) params.service_item_id = serviceItemId;

      const res: any = await api.get('/cases', { params });
      setCases(res.cases || []);
      setTotal(res.total || 0);
      setPendingCount(res.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadCases();
  };

  const handleReset = () => {
    setKeyword('');
    setServiceItemId('');
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

  const handleApprove = (caseItem: Case) => {
    setCurrentCase(caseItem);
    approveForm.resetFields();
    setApproveModalVisible(true);
  };

  const handleApproveSubmit = async () => {
    try {
      const values = await approveForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/approve`, values);
      message.success('审批通过');
      setApproveModalVisible(false);
      loadCases();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = (caseItem: Case) => {
    setCurrentCase(caseItem);
    rejectForm.resetFields();
    setRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    try {
      const values = await rejectForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/reject`, values);
      message.success('已驳回');
      setRejectModalVisible(false);
      loadCases();
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
      message.success('流转成功');
      setTransferModalVisible(false);
      loadCases();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const canReviewMaterial = (material: CaseMaterial) => {
    return material.status === 'pending' || material.status === 'correction_submitted';
  };

  const isCorrectionReview = (material: CaseMaterial) => {
    return material.status === 'correction_submitted';
  };

  const handleOpenMaterialReview = (material: CaseMaterial) => {
    setCurrentReviewMaterial(material);
    reviewForm.resetFields();
    setMaterialReviewModalVisible(true);
  };

  const handleMaterialReview = async (approved: boolean) => {
    if (!currentCase || !currentReviewMaterial) return;
    try {
      const status = approved ? 'approved' : 'rejected';
      const values = await reviewForm.validateFields();
      
      if (!approved && !values.review_comment?.trim()) {
        message.error('驳回时必须填写审核意见');
        return;
      }
      
      setReviewSubmitting(true);
      const res: any = await api.post(`/cases/${currentCase.id}/material-review`, {
        material_id: currentReviewMaterial.id,
        status,
        review_comment: values.review_comment,
      });
      message.success(approved ? '审核通过' : '已驳回');
      setMaterialReviewModalVisible(false);
      
      if (res.materials) {
        setCaseMaterials(res.materials);
      }
      
      handleViewDetail(currentCase);
      loadCases();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    } finally {
      setReviewSubmitting(false);
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

  const columns = [
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 160,
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
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
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '协同标记',
      key: 'collaboration',
      width: 130,
      render: (_: any, record: Case) => {
        if (record.collaboration_flow_id) {
          return (
            <Tooltip title={`来自 ${record.collaboration_from_department_name || '其他科室'} 的协同件`}>
              <Tag color="purple" icon={<SwapOutlined />}>
                协同件
              </Tag>
            </Tooltip>
          );
        }
        return <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>;
      },
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
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      fixed: 'right' as const,
      render: (_: any, record: Case) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handleViewReceipt(record)}>
            回执
          </Button>
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record)}>
            通过
          </Button>
          <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record)}>
            驳回
          </Button>
          <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleTransfer(record)}>
            流转
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="待我审批"
              value={pendingCount}
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日受理"
              value={0}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日办结"
              value={0}
              prefix={<CheckOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
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

      <Card title="待审批列表">
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
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
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
              <Descriptions.Item label="当前处理人">{currentCase.handler_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(currentCase.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
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
                            {item.description && (
                              <div style={{ marginBottom: 2 }}>{item.description}</div>
                            )}
                            {item.example && (
                              <div style={{ color: '#999' }}>
                                <span style={{ color: '#1890ff' }}>示例：</span>
                                {item.example}
                              </div>
                            )}
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
                      width: 110,
                      render: (s: string) => (
                        <Tag color={CaseMaterialStatusColor[s]}>
                          {CaseMaterialStatusText[s] || s}
                        </Tag>
                      ),
                    },
                    { 
                      title: '补正次数', 
                      dataIndex: 'correction_count', 
                      key: 'correction_count',
                      width: 80,
                      render: (count: number) => count || 0,
                    },
                    { title: '审核意见', dataIndex: 'review_comment', key: 'review_comment' },
                    {
                      title: '补正说明',
                      key: 'correction',
                      width: 150,
                      render: (_: any, record: CaseMaterial) => (
                        <div style={{ fontSize: 12 }}>
                          {record.correction_comment && (
                            <div style={{ color: '#1890ff', marginBottom: 2 }}>
                              {record.correction_comment}
                            </div>
                          )}
                          {record.correction_file_url && (
                            <div style={{ color: '#1890ff', fontSize: 11 }}>
                              附件: {record.correction_file_url}
                            </div>
                          )}
                          {!record.correction_comment && !record.correction_file_url && (
                            <span style={{ color: '#bfbfbf' }}>-</span>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 100,
                      fixed: 'right' as const,
                      render: (_: any, record: CaseMaterial) => (
                        canReviewMaterial(record) && (
                          <Button 
                            type="link" 
                            size="small" 
                            icon={<EditOutlined />}
                            onClick={() => handleOpenMaterialReview(record)}
                          >
                            {isCorrectionReview(record) ? '补正审核' : '审核'}
                          </Button>
                        )
                      ),
                    },
                  ]}
                  pagination={false}
                  scroll={{ x: 800 }}
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
        title="审批通过"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setApproveModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleApproveSubmit}>
            确认通过
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={approveForm} layout="vertical">
          <Form.Item name="comment" label="审批意见">
            <TextArea rows={4} placeholder="请输入审批意见（选填）" />
          </Form.Item>
          <Form.Item name="result" label="审批结果">
            <TextArea rows={3} placeholder="请输入审批结果说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审批驳回"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setRejectModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" danger loading={submitting} onClick={handleRejectSubmit}>
            确认驳回
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="comment"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <TextArea rows={4} placeholder="请输入驳回原因" />
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
        title={currentReviewMaterial && isCorrectionReview(currentReviewMaterial) ? '补正材料审核' : '材料审核'}
        open={materialReviewModalVisible}
        onCancel={() => setMaterialReviewModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setMaterialReviewModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="reject" 
            danger 
            loading={reviewSubmitting} 
            onClick={() => handleMaterialReview(false)}
          >
            驳回
          </Button>,
          <Button 
            key="approve" 
            type="primary" 
            loading={reviewSubmitting} 
            onClick={() => handleMaterialReview(true)}
          >
            通过
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        {currentReviewMaterial && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="材料名称">
                {currentReviewMaterial.name}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={CaseMaterialStatusColor[currentReviewMaterial.status]}>
                  {CaseMaterialStatusText[currentReviewMaterial.status] || currentReviewMaterial.status}
                </Tag>
              </Descriptions.Item>
              {currentReviewMaterial.file_url && (
                <Descriptions.Item label="原件地址">
                  <a href={currentReviewMaterial.file_url} target="_blank" rel="noreferrer">
                    {currentReviewMaterial.file_url}
                  </a>
                </Descriptions.Item>
              )}
              {currentReviewMaterial.review_comment && (
                <Descriptions.Item label="上次审核意见">
                  <span style={{ color: '#ff4d4f' }}>{currentReviewMaterial.review_comment}</span>
                </Descriptions.Item>
              )}
              {currentReviewMaterial.correction_comment && (
                <Descriptions.Item label="补正说明">
                  <span style={{ color: '#1890ff' }}>{currentReviewMaterial.correction_comment}</span>
                </Descriptions.Item>
              )}
              {currentReviewMaterial.correction_file_url && (
                <Descriptions.Item label="补正附件">
                  <a href={currentReviewMaterial.correction_file_url} target="_blank" rel="noreferrer">
                    {currentReviewMaterial.correction_file_url}
                  </a>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="补正次数">
                {currentReviewMaterial.correction_count || 0} 次
              </Descriptions.Item>
            </Descriptions>
            <Form form={reviewForm} layout="vertical">
              <Form.Item
                name="review_comment"
                label="审核意见"
                rules={[{ required: false, message: '请输入审核意见' }]}
              >
                <TextArea rows={4} placeholder="请输入审核意见（驳回时必填）" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="办件受理回执"
        open={receiptVisible}
        onCancel={() => setReceiptVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {currentCase && (
          <CaseReceipt
            caseData={currentCase}
            onClose={() => setReceiptVisible(false)}
          />
        )}
      </Modal>
    </div>
  );
}

export default CaseReview;
