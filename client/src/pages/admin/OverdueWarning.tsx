import { Card, Table, Button, Select, Input, Modal, Form, Input as AntInput, Tag, message, Space, Descriptions, Row, Col, Statistic, List, Tooltip, Popconfirm, Timeline } from 'antd';
import { SearchOutlined, EyeOutlined, BellOutlined, FileTextOutlined, ClockCircleOutlined, ExclamationCircleOutlined, UserOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { Case, Department, CaseMaterial, CaseFlow, ServiceItemMaterial, CaseUrgeRecord, User } from '../../types';
import { CaseStatusText, CaseFlowActionText } from '../../types';
import { getCaseMaterialList, hasCaseMaterials } from '../../utils/materials';
import { useAuthStore } from '../../store/auth';

const { TextArea } = AntInput;

function OverdueWarning() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [approvers, setApprovers] = useState<User[]>([]);
  const [keyword, setKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [days, setDays] = useState<number>(3);
  const [detailVisible, setDetailVisible] = useState(false);
  const [urgeModalVisible, setUrgeModalVisible] = useState(false);
  const [urgeConfirmVisible, setUrgeConfirmVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [caseMaterials, setCaseMaterials] = useState<CaseMaterial[]>([]);
  const [caseFlows, setCaseFlows] = useState<CaseFlow[]>([]);
  const [urgeRecords, setUrgeRecords] = useState<CaseUrgeRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [urgeSubmitting, setUrgeSubmitting] = useState(false);
  const [urgeForm] = Form.useForm();
  const [recentUrgeInfo, setRecentUrgeInfo] = useState<CaseUrgeRecord | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    overdue: 0,
    urge_count: 0,
  });

  useEffect(() => {
    loadDepartments();
    loadWarnings();
  }, [departmentId, days]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadWarnings = async () => {
    setLoading(true);
    try {
      const params: any = { days };
      if (departmentId) params.department_id = departmentId;
      if (keyword) params.keyword = keyword;

      const res: any = await api.get('/cases/warnings/overdue', { params });
      let warningCases = res.cases || [];
      
      if (keyword) {
        warningCases = warningCases.filter((c: Case) =>
          c.case_number?.includes(keyword) ||
          c.applicant_name?.includes(keyword) ||
          c.service_item_name?.includes(keyword)
        );
      }
      
      setCases(warningCases);
      
      const now = dayjs();
      const overdueCount = warningCases.filter((c: Case) => 
        c.deadline && now.isAfter(dayjs(c.deadline))
      ).length;
      const totalUrgeCount = warningCases.reduce((sum: number, c: any) => sum + (c.urge_count || 0), 0);
      
      setStats({
        total: warningCases.length,
        overdue: overdueCount,
        urge_count: totalUrgeCount,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadWarnings();
  };

  const handleReset = () => {
    setKeyword('');
    setDepartmentId('');
    setDays(3);
    loadWarnings();
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
      
      const urgeRes: any = await api.get(`/cases/${caseItem.id}/urge-records`);
      setUrgeRecords(urgeRes.records || []);
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenUrge = async (caseItem: Case) => {
    setCurrentCase(caseItem);
    urgeForm.resetFields();
    setApprovers([]);
    setRecentUrgeInfo(null);
    
    try {
      const checkRes: any = await api.get(`/cases/${caseItem.id}/urge-check`, { params: { minutes: 30 } });
      if (checkRes.has_recent_urge && checkRes.last_urge) {
        setRecentUrgeInfo(checkRes.last_urge);
        setUrgeConfirmVisible(true);
      } else {
        if (caseItem.department_id) {
          const approversRes: any = await api.get(`/cases/department/${caseItem.department_id}/approvers`);
          setApprovers(approversRes.users || []);
        }
        setUrgeModalVisible(true);
      }
    } catch (error) {
      console.error(error);
      if (caseItem.department_id) {
        const approversRes: any = await api.get(`/cases/department/${caseItem.department_id}/approvers`);
        setApprovers(approversRes.users || []);
      }
      setUrgeModalVisible(true);
    }
  };

  const handleConfirmContinueUrge = async () => {
    setUrgeConfirmVisible(false);
    if (currentCase?.department_id) {
      try {
        const approversRes: any = await api.get(`/cases/department/${currentCase.department_id}/approvers`);
        setApprovers(approversRes.users || []);
      } catch (error) {
        console.error(error);
      }
    }
    setUrgeModalVisible(true);
  };

  const handleUrgeSubmit = async () => {
    try {
      const values = await urgeForm.validateFields();
      setUrgeSubmitting(true);
      
      await api.post(`/cases/${currentCase?.id}/urge`, {
        content: values.content,
        target_user_id: values.target_user_id || undefined,
        target_department_id: currentCase?.department_id,
      });
      
      message.success('催办通知已发送，催办记录已保存');
      setUrgeModalVisible(false);
      urgeForm.resetFields();
      setRecentUrgeInfo(null);
      
      if (detailVisible && currentCase) {
        handleViewDetail(currentCase);
      }
      loadWarnings();
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || '催办失败');
    } finally {
      setUrgeSubmitting(false);
    }
  };

  const getUrgencyLevel = (deadline: string) => {
    const now = dayjs();
    const diffHours = dayjs(deadline).diff(now, 'hour');
    if (diffHours < 0) return { level: '已超期', color: 'red', icon: <ExclamationCircleOutlined /> };
    if (diffHours <= 24) return { level: '紧急', color: 'orange', icon: <ClockCircleOutlined /> };
    return { level: '预警', color: 'gold', icon: <BellOutlined /> };
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
      title: '预警级别',
      key: 'urgency',
      width: 100,
      fixed: 'left' as const,
      render: (_: any, record: Case) => {
        if (!record.deadline) return <Tag>未知</Tag>;
        const { level, color, icon } = getUrgencyLevel(record.deadline);
        return (
          <Tag color={color} icon={icon}>
            {level}
          </Tag>
        );
      },
    },
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
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 180,
      render: (text: string) => {
        if (!text) return '-';
        const { color } = getUrgencyLevel(text);
        return (
          <span style={{ color: color === 'red' ? '#ff4d4f' : color === 'orange' ? '#faad14' : undefined }}>
            {dayjs(text).format('YYYY-MM-DD HH:mm')}
          </span>
        );
      },
    },
    {
      title: '催办次数',
      dataIndex: 'urge_count',
      key: 'urge_count',
      width: 90,
      render: (count: number) => {
        const displayCount = count || 0;
        return displayCount > 0 ? (
          <Tag color={displayCount >= 3 ? 'red' : displayCount >= 2 ? 'orange' : 'blue'}>
            {displayCount}次
          </Tag>
        ) : (
          <span style={{ color: '#bfbfbf' }}>0次</span>
        );
      },
    },
    {
      title: '最近催办',
      dataIndex: 'last_urge_time',
      key: 'last_urge_time',
      width: 160,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Case) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button 
            type="link" 
            size="small" 
            danger 
            icon={<BellOutlined />} 
            onClick={() => handleOpenUrge(record)}
          >
            催办
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
              title="预警办件总数"
              value={stats.total}
              prefix={<BellOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已超期办件"
              value={stats.overdue}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="累计催办次数"
              value={stats.urge_count}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input
            placeholder="搜索办件编号/申请人/服务事项"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
            onPressEnter={handleSearch}
          />
          {user?.role === 'admin' && (
            <Select
              placeholder="选择科室"
              value={departmentId || undefined}
              onChange={setDepartmentId}
              style={{ width: 180 }}
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
          )}
          <Select
            placeholder="预警天数"
            value={days}
            onChange={(v) => setDays(v)}
            style={{ width: 140 }}
          >
            <Select.Option value={1}>1天内</Select.Option>
            <Select.Option value={3}>3天内</Select.Option>
            <Select.Option value={7}>7天内</Select.Option>
            <Select.Option value={15}>15天内</Select.Option>
            <Select.Option value={30}>30天内</Select.Option>
          </Select>
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card title="超期预警列表">
        <Table
          columns={columns}
          dataSource={cases}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="预警办件详情"
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          currentCase && (
            <Button
              key="urge"
              type="primary"
              danger
              icon={<BellOutlined />}
              onClick={() => handleOpenUrge(currentCase)}
            >
              发送催办
            </Button>
          ),
        ]}
        width={900}
        destroyOnClose
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : currentCase && (
          <div>
            <Descriptions title="基本信息" bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="办件编号">{currentCase.case_number}</Descriptions.Item>
              <Descriptions.Item label="预警级别">
                {currentCase.deadline && (() => {
                  const { level, color } = getUrgencyLevel(currentCase.deadline);
                  return <Tag color={color}>{level}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="服务事项">{currentCase.service_item_name}</Descriptions.Item>
              <Descriptions.Item label="所属科室">{currentCase.department_name}</Descriptions.Item>
              <Descriptions.Item label="申请人">{currentCase.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{currentCase.applicant_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(currentCase.status)}>
                  {CaseStatusText[currentCase.status as keyof typeof CaseStatusText]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="截止时间">
                {currentCase.deadline ? dayjs(currentCase.deadline).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前处理人">{currentCase.handler_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(currentCase.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {urgeRecords.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>
                  <BellOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  催办历史记录（{urgeRecords.length}次）
                </h4>
                <Card size="small" style={{ background: '#fffbe6' }}>
                  <Timeline
                    items={urgeRecords.map((record) => ({
                      color: 'orange',
                      children: (
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            <Space size={8}>
                              <Tag color="blue">
                                <UserOutlined style={{ marginRight: 4 }} />
                                催办人：{record.urge_user_name || '未知'}
                              </Tag>
                              {record.target_user_name && (
                                <Tag color="green">
                                  <UserOutlined style={{ marginRight: 4 }} />
                                  催办对象：{record.target_user_name}
                                </Tag>
                              )}
                              {record.target_department_name && !record.target_user_name && (
                                <Tag color="purple">
                                  <ApartmentOutlined style={{ marginRight: 4 }} />
                                  催办科室：{record.target_department_name}
                                </Tag>
                              )}
                            </Space>
                          </div>
                          <div style={{ marginBottom: 4, padding: '8px 12px', background: '#fff', borderRadius: 4, border: '1px solid #ffe58f' }}>
                            {record.content}
                          </div>
                          <div style={{ color: '#999', fontSize: 12 }}>
                            {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </div>
                      ),
                    }))}
                  />
                </Card>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>
                  <BellOutlined style={{ color: '#bfbfbf', marginRight: 8 }} />
                  催办历史记录
                </h4>
                <Card size="small">
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#bfbfbf' }}>
                    <BellOutlined style={{ fontSize: 32, marginBottom: 8, color: '#d9d9d9' }} />
                    <div>暂无催办记录</div>
                  </div>
                </Card>
              </div>
            )}

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
                      width: 100,
                      render: (s: string) => {
                        const map: Record<string, { text: string; color: string }> = {
                          pending: { text: '待审核', color: 'orange' },
                          approved: { text: '通过', color: 'green' },
                          rejected: { text: '不通过', color: 'red' },
                        };
                        const info = map[s] || { text: s, color: 'default' };
                        return <Tag color={info.color}>{info.text}</Tag>;
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
        title="重复催办确认"
        open={urgeConfirmVisible}
        onCancel={() => {
          setUrgeConfirmVisible(false);
          setRecentUrgeInfo(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setUrgeConfirmVisible(false);
            setRecentUrgeInfo(null);
          }}>
            取消
          </Button>,
          <Button key="continue" type="primary" danger onClick={handleConfirmContinueUrge}>
            确认继续催办
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 24, marginRight: 12, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8, color: '#faad14' }}>
                检测到短时间内已对该办件进行过催办
              </div>
              <div style={{ color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                最近一次催办信息：
                <br />
                {recentUrgeInfo && (
                  <>
                    <div>催办人：{recentUrgeInfo.urge_user_name || '未知'}</div>
                    <div>催办时间：{dayjs(recentUrgeInfo.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                    <div>催办内容：{recentUrgeInfo.content}</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={{ background: '#fff7e6', padding: 12, borderRadius: 4, border: '1px solid #ffd591', fontSize: 13 }}>
            <strong>提示：</strong>频繁催办可能会打扰到办理人员，请确认是否需要继续发送催办通知。
          </div>
        </div>
      </Modal>

      <Modal
        title={`发送催办通知 - ${currentCase?.case_number || ''}`}
        open={urgeModalVisible}
        onCancel={() => setUrgeModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setUrgeModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={urgeSubmitting}
            onClick={handleUrgeSubmit}
          >
            确认催办
          </Button>,
        ]}
        width={550}
        destroyOnClose
      >
        <Form form={urgeForm} layout="vertical">
          <Form.Item label="办件信息">
            <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>办件编号：</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{currentCase?.case_number}</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>服务事项：</span>
                <span>{currentCase?.service_item_name}</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>所属科室：</span>
                <span>{currentCase?.department_name}</span>
              </div>
              <div>
                <span style={{ color: '#666' }}>截止时间：</span>
                <span style={{ color: '#ff4d4f' }}>
                  {currentCase?.deadline ? dayjs(currentCase.deadline).format('YYYY-MM-DD HH:mm') : '-'}
                </span>
              </div>
            </div>
          </Form.Item>
          <Form.Item label="催办范围">
            <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
              <div style={{ color: '#666', marginBottom: 4 }}>
                <ApartmentOutlined style={{ marginRight: 4 }} />
                催办科室：<strong>{currentCase?.department_name}</strong>
              </div>
              <div style={{ color: '#999', fontSize: 12 }}>
                提示：不选择催办对象将通知该科室所有审批人员，选择后仅通知指定人员
              </div>
            </div>
          </Form.Item>
          <Form.Item
            name="target_user_id"
            label="催办对象（可选，不选则催办整个科室）"
          >
            <Select
              placeholder="请选择催办对象（审批人员）"
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {approvers.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="催办内容"
            rules={[{ required: true, message: '请输入催办内容' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入催办内容，例如：请尽快处理该办件，已临近截止时间..."
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default OverdueWarning;
