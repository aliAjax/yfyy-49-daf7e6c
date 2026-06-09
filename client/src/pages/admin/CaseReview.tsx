import { Card, Table, Button, Select, Input, Modal, Form, Input as AntInput, Tag, message, Space, Descriptions, Row, Col, Statistic } from 'antd';
import { SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined, SwapOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department, CaseMaterial, CaseFlow } from '../../types';
import { CaseStatusText } from '../../types';

const { TextArea } = AntInput;

function CaseReview() {
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [serviceItemId, setServiceItemId] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [materialRejectModalVisible, setMaterialRejectModalVisible] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<CaseMaterial | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [batchReviewVisible, setBatchReviewVisible] = useState(false);
  const [batchReviews, setBatchReviews] = useState<Record<string, { status: 'approved' | 'rejected'; review_comment: string }>>({});
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [materialRejectForm] = Form.useForm();
  const [pendingCount, setPendingCount] = useState(0);

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
      const baseParams: any = {
        page,
        pageSize,
      };
      if (keyword) baseParams.keyword = keyword;
      if (serviceItemId) baseParams.service_item_id = serviceItemId;

      const [reviewingRes, materialRes]: any[] = await Promise.all([
        api.get('/cases', { params: { ...baseParams, status: 'reviewing' } }),
        api.get('/cases', { params: { ...baseParams, status: 'material_reviewing' } }),
      ]);
      const mergedCases = [...(materialRes.cases || []), ...(reviewingRes.cases || [])];
      setCases(mergedCases);
      const mergedTotal = (materialRes.total || 0) + (reviewingRes.total || 0);
      setTotal(mergedTotal);
      setPendingCount(mergedTotal);
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
    setSelectedMaterialIds([]);
    setBatchReviews({});
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
    setTransferModalVisible(true);
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

  const reloadCurrentCaseDetail = async () => {
    if (!currentCase) return;
    const res: any = await api.get(`/cases/${currentCase.id}`);
    setCurrentCase(res.case);
    setCaseMaterials(res.materials || []);
    setCaseFlows(res.flows || []);
  };

  const handleMaterialApprove = async (material: CaseMaterial) => {
    try {
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/material-review`, {
        material_id: material.id,
        status: 'approved',
        review_comment: '材料审核通过',
      });
      message.success('材料审核通过');
      await reloadCurrentCaseDetail();
      loadCases();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMaterialReject = (material: CaseMaterial) => {
    setCurrentMaterial(material);
    materialRejectForm.resetFields();
    setMaterialRejectModalVisible(true);
  };

  const handleMaterialRejectSubmit = async () => {
    try {
      const values = await materialRejectForm.validateFields();
      setSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/material-review`, {
        material_id: currentMaterial?.id,
        status: 'rejected',
        review_comment: values.review_comment,
      });
      message.success('材料已驳回');
      setMaterialRejectModalVisible(false);
      await reloadCurrentCaseDetail();
      loadCases();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingMaterials = caseMaterials.filter((material) => material.status === 'pending');

  const handleOpenBatchReview = () => {
    if (selectedMaterialIds.length === 0) {
      message.warning('请先选择待审核材料');
      return;
    }

    const nextReviews = selectedMaterialIds.reduce<Record<string, { status: 'approved' | 'rejected'; review_comment: string }>>(
      (drafts, materialId) => {
        drafts[materialId] = batchReviews[materialId] || { status: 'approved', review_comment: '材料审核通过' };
        return drafts;
      },
      {}
    );
    setBatchReviews(nextReviews);
    setBatchReviewVisible(true);
  };

  const handleBatchReviewChange = (
    materialId: string,
    field: 'status' | 'review_comment',
    value: 'approved' | 'rejected' | string
  ) => {
    setBatchReviews((prev) => {
      const current = prev[materialId] || { status: 'approved', review_comment: '材料审核通过' };
      const next = { ...current, [field]: value };
      if (field === 'status') {
        next.review_comment = value === 'approved' ? (current.review_comment || '材料审核通过') : '';
      }
      return { ...prev, [materialId]: next };
    });
  };

  const handleBatchReviewSubmit = async () => {
    const selectedMaterials = caseMaterials.filter((material) => selectedMaterialIds.includes(material.id));
    const invalidReview = selectedMaterials.find((material) => {
      const review = batchReviews[material.id];
      return !review || !review.status || (review.status === 'rejected' && !review.review_comment.trim());
    });

    if (invalidReview) {
      message.warning('请补全所选材料的审核结果，驳回时必须填写意见');
      return;
    }

    try {
      setBatchSubmitting(true);
      await api.post(`/cases/${currentCase?.id}/material-batch-review`, {
        reviews: selectedMaterials.map((material) => {
          const review = batchReviews[material.id];
          return {
            material_id: material.id,
            status: review.status,
            review_comment: review.review_comment.trim(),
          };
        }),
      });
      message.success('材料批量审核完成');
      setBatchReviewVisible(false);
      setSelectedMaterialIds([]);
      setBatchReviews({});
      await reloadCurrentCaseDetail();
      loadCases();
    } catch (error) {
      console.error(error);
    } finally {
      setBatchSubmitting(false);
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
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: Case) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
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
        onCancel={() => {
          setDetailVisible(false);
          setSelectedMaterialIds([]);
          setBatchReviews({});
        }}
        footer={[
          pendingMaterials.length > 0 && (
            <Button
              key="batch-review"
              type="primary"
              disabled={selectedMaterialIds.length === 0}
              loading={batchSubmitting}
              onClick={handleOpenBatchReview}
            >
              批量审核{selectedMaterialIds.length > 0 ? `(${selectedMaterialIds.length})` : ''}
            </Button>
          ),
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ].filter(Boolean)}
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

            {caseMaterials.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ marginBottom: 0 }}>材料清单</h4>
                  {pendingMaterials.length > 0 && (
                    <Button
                      size="small"
                      type="primary"
                      disabled={selectedMaterialIds.length === 0}
                      onClick={handleOpenBatchReview}
                    >
                      批量审核{selectedMaterialIds.length > 0 ? `(${selectedMaterialIds.length})` : ''}
                    </Button>
                  )}
                </div>
                <Table
                  size="small"
                  dataSource={caseMaterials}
                  rowKey="id"
                  rowSelection={{
                    selectedRowKeys: selectedMaterialIds,
                    onChange: (selectedRowKeys) => setSelectedMaterialIds(selectedRowKeys as string[]),
                    getCheckboxProps: (material: CaseMaterial) => ({
                      disabled: material.status !== 'pending',
                    }),
                  }}
                  columns={[
                    { title: '材料名称', dataIndex: 'name', key: 'name' },
                    { title: '附件地址', dataIndex: 'file_url', key: 'file_url', render: (v: string) => v || '-' },
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
                    { title: '补正说明', dataIndex: 'correction_comment', key: 'correction_comment', render: (v: string) => v || '-' },
                    {
                      title: '操作',
                      key: 'action',
                      width: 140,
                      render: (_: any, material: CaseMaterial) => (
                        <Space size="small">
                          <Button
                            type="link"
                            size="small"
                            disabled={material.status !== 'pending' || submitting}
                            onClick={() => handleMaterialApprove(material)}
                          >
                            通过
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            danger
                            disabled={material.status !== 'pending' || submitting}
                            onClick={() => handleOpenMaterialReject(material)}
                          >
                            驳回
                          </Button>
                        </Space>
                      ),
                    },
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
                    { title: '操作', dataIndex: 'action', key: 'action', width: 100 },
                    { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
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
        title="批量审核材料"
        open={batchReviewVisible}
        onCancel={() => setBatchReviewVisible(false)}
        width={720}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setBatchReviewVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={batchSubmitting} onClick={handleBatchReviewSubmit}>
            提交审核
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {caseMaterials
            .filter((material) => selectedMaterialIds.includes(material.id))
            .map((material) => {
              const review = batchReviews[material.id] || { status: 'approved', review_comment: '材料审核通过' };
              return (
                <Card key={material.id} size="small" title={material.name}>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Select
                      value={review.status}
                      style={{ width: 160 }}
                      onChange={(value) => handleBatchReviewChange(material.id, 'status', value)}
                    >
                      <Select.Option value="approved">通过</Select.Option>
                      <Select.Option value="rejected">驳回</Select.Option>
                    </Select>
                    <TextArea
                      rows={3}
                      value={review.review_comment}
                      status={review.status === 'rejected' && !review.review_comment.trim() ? 'error' : undefined}
                      placeholder={review.status === 'rejected' ? '请输入驳回原因' : '请输入审核意见'}
                      onChange={(event) => handleBatchReviewChange(material.id, 'review_comment', event.target.value)}
                    />
                  </Space>
                </Card>
              );
            })}
        </Space>
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
        title="跨科室流转"
        open={transferModalVisible}
        onCancel={() => setTransferModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setTransferModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleTransferSubmit}>
            确认流转
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
            <Select placeholder="请选择目标科室" showSearch optionFilterProp="children">
              {departments
                .filter((d) => d.id !== currentCase?.department_id)
                .map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="comment" label="流转说明">
            <TextArea rows={4} placeholder="请输入流转说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="材料驳回"
        open={materialRejectModalVisible}
        onCancel={() => setMaterialRejectModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setMaterialRejectModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" danger loading={submitting} onClick={handleMaterialRejectSubmit}>
            确认驳回
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={materialRejectForm} layout="vertical">
          <Form.Item label="材料名称">
            <Input value={currentMaterial?.name} disabled />
          </Form.Item>
          <Form.Item
            name="review_comment"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <TextArea rows={4} placeholder="请输入驳回原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CaseReview;
