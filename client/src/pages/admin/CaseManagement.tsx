import { Card, Table, Button, Select, Input, Modal, Tag, message, Space, Descriptions, Row, Col, Statistic } from 'antd';
import { SearchOutlined, EyeOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department, ServiceItem, CaseMaterial, CaseFlow } from '../../types';
import { CaseStatusText } from '../../types';

function CaseManagement() {
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [status, setStatus] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [serviceItemId, setServiceItemId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [batchReviewVisible, setBatchReviewVisible] = useState(false);
  const [batchReviews, setBatchReviews] = useState<Record<string, { status: 'approved' | 'rejected'; review_comment: string }>>({});
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
  });

  useEffect(() => {
    loadDepartments();
    loadServiceItems();
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

  const loadServiceItems = async () => {
    try {
      const res: any = await api.get('/service/service-items/all');
      setServiceItems(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
      };
      if (status) params.status = status;
      if (departmentId) params.department_id = departmentId;
      if (serviceItemId) params.service_item_id = serviceItemId;
      if (keyword) params.keyword = keyword;

      const res: any = await api.get('/cases', { params });
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
    loadCases();
  };

  const handleReset = () => {
    setStatus('');
    setDepartmentId('');
    setServiceItemId('');
    setKeyword('');
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

  const reloadCurrentCaseDetail = async () => {
    if (!currentCase) return;
    const res: any = await api.get(`/cases/${currentCase.id}`);
    setCurrentCase(res.case);
    setCaseMaterials(res.materials || []);
    setCaseFlows(res.flows || []);
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
      title: '当前处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 100,
      render: (text: string) => text || '-',
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
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: Case) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总办件数"
              value={total}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="办理中"
              value={stats.processing}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已驳回"
              value={stats.rejected}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
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
          <Select
            placeholder="选择状态"
            value={status || undefined}
            onChange={setStatus}
            style={{ width: 150 }}
            allowClear
          >
            {Object.entries(CaseStatusText).map(([key, text]) => (
              <Select.Option key={key} value={key}>
                {text}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="选择科室"
            value={departmentId || undefined}
            onChange={setDepartmentId}
            style={{ width: 150 }}
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
            style={{ width: 180 }}
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
            搜索
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card title="办件列表">
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
                    { title: '操作', dataIndex: 'action', key: 'action', width: 100 },
                    { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
                    { title: '上一状态', dataIndex: 'previous_status', key: 'previous_status', width: 120, render: (v: string) => v || '-' },
                    { title: '操作人', dataIndex: 'from_user_name', key: 'from_user_name', width: 100 },
                    {
                      title: '流转',
                      key: 'department_path',
                      width: 180,
                      render: (_: any, flow: CaseFlow) => {
                        const from = flow.from_department_name || flow.from_user_name || '-';
                        const to = flow.to_department_name || flow.to_user_name;
                        return to ? `${from} → ${to}${flow.to_user_name ? `/${flow.to_user_name}` : ''}` : from;
                      },
                    },
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
                    <Input.TextArea
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
    </div>
  );
}

export default CaseManagement;
