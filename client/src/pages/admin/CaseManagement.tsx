import { Card, Table, Button, Select, Input, Modal, Tag, message, Space, Descriptions, Row, Col, Statistic, List, Form, Tooltip, Alert } from 'antd';
import { SearchOutlined, EyeOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, PrinterOutlined, PlusOutlined, SwapOutlined, CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department, ServiceItem, CaseMaterial, CaseFlow, ServiceItemMaterial, Window } from '../../types';
import { CaseStatusText, CaseFlowActionText, CaseMaterialStatusText, CaseMaterialStatusColor } from '../../types';
import { getCaseMaterialList, hasCaseMaterials } from '../../utils/materials';
import CaseReceipt from '../../components/CaseReceipt';

function CaseManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [status, setStatus] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [serviceItemId, setServiceItemId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createSuccessVisible, setCreateSuccessVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [newCase, setNewCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
  });
  const [materialReviewModalVisible, setMaterialReviewModalVisible] = useState(false);
  const [currentReviewMaterial, setCurrentReviewMaterial] = useState<CaseMaterial | null>(null);
  const [reviewForm] = Form.useForm();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    loadDepartments();
    loadServiceItems();
    loadWindows();
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

  const loadWindows = async () => {
    try {
      const res: any = await api.get('/system/windows');
      setWindows(res.windows || []);
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

  const canReviewMaterial = (material: CaseMaterial) => {
    return ['pending', 'correction_submitted'].includes(material.status);
  };

  const isCorrectionReview = (material: CaseMaterial) => {
    return material.status === 'correction_submitted';
  };

  const handleOpenMaterialReview = (material: CaseMaterial) => {
    setCurrentReviewMaterial(material);
    reviewForm.resetFields();
    setMaterialReviewModalVisible(true);
  };

  const handleMaterialReview = async (status: 'approved' | 'rejected') => {
    if (!currentReviewMaterial || !currentCase) return;
    
    try {
      const values = await reviewForm.validateFields();
      
      if (status === 'rejected' && !values.review_comment?.trim()) {
        message.error('驳回时必须填写审核意见');
        return;
      }
      
      setReviewSubmitting(true);

      const res: any = await api.post(`/cases/${currentCase.id}/material-review`, {
        material_id: currentReviewMaterial.id,
        status,
        review_comment: values.review_comment,
      });

      message.success(status === 'approved' ? '审核通过' : '已驳回');
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

  const handleOpenCreate = () => {
    createForm.resetFields();
    setCreateVisible(true);
  };

  const handleCreateCase = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      const res: any = await api.post('/cases', values);
      if (res.case) {
        setNewCase(res.case);
        setCreateVisible(false);
        setCreateSuccessVisible(true);
        message.success('办件创建成功');
        loadCases();
      }
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || '创建失败');
    } finally {
      setCreateLoading(false);
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
      width: 120,
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
        if (record.status === 'cross_department') {
          return (
            <Tag color="gold" icon={<SwapOutlined />}>
              流转中
            </Tag>
          );
        }
        return <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>;
      },
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
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: Case) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'material_reviewing' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleViewDetail(record)}>
              材料审核
            </Button>
          )}
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handleViewReceipt(record)}>
            回执
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

      <Card
        title="办件列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建办件
          </Button>
        }
      >
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
                <h4 style={{ marginBottom: 8 }}>
                  已提交材料
                  {caseMaterials.some(m => canReviewMaterial(m)) && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      待审核 {caseMaterials.filter(m => canReviewMaterial(m)).length} 项
                    </Tag>
                  )}
                </h4>
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
                      render: (_: any, record: CaseMaterial) => (
                        canReviewMaterial(record) ? (
                          <Button 
                            type="link" 
                            size="small" 
                            onClick={() => handleOpenMaterialReview(record)}
                          >
                            {isCorrectionReview(record) ? '补正审核' : '审核'}
                          </Button>
                        ) : (
                          <span style={{ color: '#bfbfbf' }}>-</span>
                        )
                      ),
                    },
                  ]}
                  pagination={false}
                  scroll={{ x: 700 }}
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

      <Modal
        title="新建办件"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={createLoading} onClick={handleCreateCase}>
            创建
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="service_item_id"
            label="服务事项"
            rules={[{ required: true, message: '请选择服务事项' }]}
          >
            <Select
              placeholder="请选择服务事项"
              showSearch
              optionFilterProp="children"
              options={serviceItems.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="applicant_name"
            label="申请人姓名"
            rules={[{ required: true, message: '请输入申请人姓名' }]}
          >
            <Input placeholder="请输入申请人姓名" />
          </Form.Item>
          <Form.Item
            name="applicant_phone"
            label="联系电话"
            rules={[
              { required: true, message: '请输入联系电话' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' },
            ]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="applicant_id_card" label="身份证号">
            <Input placeholder="请输入身份证号（可选）" />
          </Form.Item>
          <Form.Item name="window_id" label="受理窗口">
            <Select
              placeholder="请选择受理窗口"
              allowClear
              options={windows.map((w) => ({
                label: `${w.number} - ${w.name}`,
                value: w.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="办件创建成功"
        open={createSuccessVisible}
        onCancel={() => setCreateSuccessVisible(false)}
        footer={[
          <Button key="close" onClick={() => setCreateSuccessVisible(false)}>
            关闭
          </Button>,
          <Button
            key="detail"
            onClick={() => {
              if (newCase) {
                setCreateSuccessVisible(false);
                handleViewDetail(newCase);
              }
            }}
          >
            查看详情
          </Button>,
          <Button
            key="receipt"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => {
              if (newCase) {
                setCreateSuccessVisible(false);
                handleViewReceipt(newCase);
              }
            }}
          >
            打印回执
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div
            style={{
              fontSize: 48,
              color: '#52c41a',
              marginBottom: 16,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            办件创建成功
          </div>
          {newCase && (
            <div style={{ background: '#f6ffed', padding: '16px 24px', borderRadius: 8, textAlign: 'left' }}>
              <p style={{ margin: '8px 0' }}>
                <span style={{ color: '#666' }}>办件编号：</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{newCase.case_number}</span>
              </p>
              <p style={{ margin: '8px 0' }}>
                <span style={{ color: '#666' }}>申请人：</span>
                <span>{newCase.applicant_name}</span>
              </p>
              <p style={{ margin: '8px 0' }}>
                <span style={{ color: '#666' }}>服务事项：</span>
                <span>{newCase.service_item_name}</span>
              </p>
            </div>
          )}
          <p style={{ color: '#999', marginTop: 16, fontSize: 13 }}>
            点击"打印回执"可查看并打印办件受理回执
          </p>
        </div>
      </Modal>

      <Modal
        title={
          <span>
            {currentReviewMaterial && isCorrectionReview(currentReviewMaterial) ? '补正材料审核' : '材料审核'}
            {' - '}
            {currentReviewMaterial?.name}
          </span>
        }
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
            icon={<CloseOutlined />}
            onClick={() => handleMaterialReview('rejected')}
          >
            不通过
          </Button>,
          <Button 
            key="approve" 
            type="primary" 
            loading={reviewSubmitting} 
            icon={<CheckOutlined />}
            onClick={() => handleMaterialReview('approved')}
          >
            通过
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        {currentReviewMaterial && (
          <div>
            {currentReviewMaterial.status === 'correction_submitted' && (
              <Alert
                message="补正材料"
                description="这是市民提交的补正材料，请认真审核。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="材料名称">
                {currentReviewMaterial.name}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={CaseMaterialStatusColor[currentReviewMaterial.status]}>
                  {CaseMaterialStatusText[currentReviewMaterial.status]}
                </Tag>
              </Descriptions.Item>
              {currentReviewMaterial.file_url && (
                <Descriptions.Item label="原件地址">
                  {currentReviewMaterial.file_url}
                </Descriptions.Item>
              )}
              {currentReviewMaterial.correction_count && currentReviewMaterial.correction_count > 0 && (
                <Descriptions.Item label="补正次数">
                  第 {currentReviewMaterial.correction_count} 次补正
                </Descriptions.Item>
              )}
              {currentReviewMaterial.correction_comment && (
                <Descriptions.Item label="补正说明">
                  <span style={{ color: '#1890ff' }}>{currentReviewMaterial.correction_comment}</span>
                </Descriptions.Item>
              )}
              {currentReviewMaterial.correction_file_url && (
                <Descriptions.Item label="补正附件">
                  <span style={{ color: '#1890ff' }}>{currentReviewMaterial.correction_file_url}</span>
                </Descriptions.Item>
              )}
              {currentReviewMaterial.last_corrected_at && (
                <Descriptions.Item label="补正时间">
                  {dayjs(currentReviewMaterial.last_corrected_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {currentReviewMaterial.review_comment && (
                <Descriptions.Item label="上次审核意见">
                  {currentReviewMaterial.review_comment}
                </Descriptions.Item>
              )}
            </Descriptions>
            
            <Form form={reviewForm} layout="vertical">
              <Form.Item
                name="review_comment"
                label="审核意见"
                rules={[
                  { 
                    validator: (_, value) => {
                      // 如果是驳回，必须填写审核意见
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input.TextArea 
                  rows={4} 
                  placeholder="请输入审核意见（驳回时必填）" 
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CaseManagement;
