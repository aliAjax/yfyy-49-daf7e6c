import { Card, Descriptions, Tag, Timeline, Button, Spin, Modal, Form, Rate, Input, message, List, Space } from 'antd';
import { ArrowLeftOutlined, StarOutlined, PrinterOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import type { Case, CaseMaterial, CaseFlow, Evaluation, ServiceItemMaterial } from '../../types';
import { CaseStatusText, CaseFlowActionText } from '../../types';
import { getCaseMaterialList, hasCaseMaterials } from '../../utils/materials';
import dayjs from 'dayjs';
import CaseReceipt from '../../components/CaseReceipt';

const { TextArea } = Input;

function CitizenCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [materials, setMaterials] = useState<CaseMaterial[]>([]);
  const [flows, setFlows] = useState<CaseFlow[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evalModalVisible, setEvalModalVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [evalForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadCaseDetail();
      loadEvaluation();
    }
  }, [id]);

  const loadCaseDetail = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/cases/${id}`);
      setCaseData(res.case);
      setMaterials(res.materials || []);
      setFlows(res.flows || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluation = async () => {
    try {
      const res: any = await api.get(`/evaluations/case/${id}`);
      setEvaluation(res.evaluation || null);
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'default',
      submitted: 'blue',
      material_reviewing: 'orange',
      material_correction: 'warning',
      accepting: 'processing',
      reviewing: 'processing',
      cross_department: 'purple',
      approved: 'success',
      rejected: 'error',
      completed: 'success',
    };
    return colorMap[status] || 'default';
  };

  const getMaterialStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red',
    };
    return colorMap[status] || 'default';
  };

  const getMaterialStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回',
    };
    return textMap[status] || status;
  };

  const handleSubmitEvaluation = async () => {
    try {
      const values = await evalForm.validateFields();
      setSubmitting(true);

      await api.post('/evaluations', {
        case_id: id,
        overall_rating: values.overall_rating,
        service_attitude_rating: values.service_attitude_rating,
        processing_speed_rating: values.processing_speed_rating,
        material_requirement_rating: values.material_requirement_rating,
        comment: values.comment,
        suggestions: values.suggestions,
      });

      message.success('评价提交成功');
      setEvalModalVisible(false);
      evalForm.resetFields();
      loadEvaluation();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const getTimelineColor = (action: string, status: string) => {
    if (status === 'rejected') return 'red';
    if (status === 'completed' || status === 'approved') return 'green';
    if (action === 'transfer') return 'purple';
    if (action === 'receive') return 'cyan';
    if (action === 'return') return 'orange';
    if (action === 'collaborate_complete') return 'green';
    return 'blue';
  };

  const renderTimeline = () => {
    return (
      <Timeline
        items={flows.map((flow) => ({
          color: getTimelineColor(flow.action, flow.status),
          children: (
            <div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                {CaseFlowActionText[flow.action] || flow.action}
              </div>
              <div style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>
                {flow.comment || ''}
              </div>
              {(flow.from_department_name || flow.to_department_name) && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                  {flow.from_department_name || '系统'}
                  {flow.to_department_name && flow.to_department_name !== flow.from_department_name && (
                    <span style={{ color: '#1890ff', margin: '0 4px' }}>→</span>
                  )}
                  {flow.to_department_name && flow.to_department_name !== flow.from_department_name && (
                    <span>{flow.to_department_name}</span>
                  )}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#999' }}>
                {dayjs(flow.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            </div>
          ),
        }))}
      />
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/citizen/cases')}>
            返回列表
          </Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => setReceiptVisible(true)}>
            查看回执
          </Button>
        </Space>
      </div>

      <Card title="办件基本信息" style={{ marginBottom: 16 }}>
        {caseData && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="办件编号">{caseData.case_number}</Descriptions.Item>
            <Descriptions.Item label="服务事项">
              {caseData.service_item_name}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={getStatusColor(caseData.status)}>
                {CaseStatusText[caseData.status as keyof typeof CaseStatusText]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="办理科室">
              {caseData.department_name}
            </Descriptions.Item>
            <Descriptions.Item label="申请人">{caseData.applicant_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{caseData.applicant_phone}</Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {dayjs(caseData.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {caseData.completed_at && (
              <Descriptions.Item label="办结时间">
                {dayjs(caseData.completed_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            {caseData.deadline && (
              <Descriptions.Item label="办理时限">
                {dayjs(caseData.deadline).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            {caseData.result && (
              <Descriptions.Item label="办理结果" span={2}>
                {caseData.result}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Card>

      {caseData && hasCaseMaterials(caseData) && (
        <Card title="所需材料" style={{ marginBottom: 16 }}>
          <List
            dataSource={getCaseMaterialList(caseData)}
            renderItem={(item) => (
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
                    <div style={{ fontSize: 13 }}>
                      {item.description && (
                        <div style={{ marginBottom: 4 }}>{item.description}</div>
                      )}
                      {item.example && (
                        <div style={{ color: '#999', fontSize: 12 }}>
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
        </Card>
      )}

      <Card title="已提交材料" style={{ marginBottom: 16 }}>
        {materials.length > 0 ? (
          materials.map((material, index) => (
            <div
              key={material.id}
              style={{
                padding: '12px 16px',
                border: '1px solid #f0f0f0',
                borderRadius: 4,
                marginBottom: index < materials.length - 1 ? 8 : 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{material.name}</span>
                <Tag color={getMaterialStatusColor(material.status)}>
                  {getMaterialStatusText(material.status)}
                </Tag>
              </div>
              {material.review_comment && (
                <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                  审核意见：{material.review_comment}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
            暂无材料
          </div>
        )}
      </Card>

      <Card title="审批流转" style={{ marginBottom: 16 }}>
        {flows.length > 0 ? (
          renderTimeline()
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
            暂无流转记录
          </div>
        )}
      </Card>

      {caseData?.status === 'completed' && (
        <Card title="办件评价">
          {evaluation ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ marginRight: 12 }}>综合评分：</span>
                <Rate disabled value={evaluation.overall_rating} character={<StarOutlined />} />
                <span style={{ marginLeft: 8, color: '#faad14' }}>{evaluation.overall_rating} 分</span>
              </div>
              {evaluation.comment && (
                <div style={{ color: '#666', marginTop: 8 }}>
                  <span style={{ fontWeight: 500 }}>评价内容：</span>
                  {evaluation.comment}
                </div>
              )}
              {evaluation.suggestions && (
                <div style={{ color: '#666', marginTop: 8 }}>
                  <span style={{ fontWeight: 500 }}>意见建议：</span>
                  {evaluation.suggestions}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
                评价时间：{dayjs(evaluation.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#666', marginBottom: 16 }}>您还未对此办件进行评价</p>
              <Button type="primary" onClick={() => setEvalModalVisible(true)}>
                立即评价
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal
        title="办件评价"
        open={evalModalVisible}
        onCancel={() => setEvalModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEvalModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmitEvaluation}>
            提交评价
          </Button>,
        ]}
        width={500}
      >
        <Form form={evalForm} layout="vertical">
          <Form.Item
            name="overall_rating"
            label="综合评分"
            rules={[{ required: true, message: '请给出综合评分' }]}
          >
            <Rate character={<StarOutlined />} />
          </Form.Item>
          <Form.Item name="service_attitude_rating" label="服务态度">
            <Rate character={<StarOutlined />} />
          </Form.Item>
          <Form.Item name="processing_speed_rating" label="办理速度">
            <Rate character={<StarOutlined />} />
          </Form.Item>
          <Form.Item name="material_requirement_rating" label="材料要求">
            <Rate character={<StarOutlined />} />
          </Form.Item>
          <Form.Item name="comment" label="评价内容">
            <TextArea rows={4} placeholder="请输入您的评价内容" />
          </Form.Item>
          <Form.Item name="suggestions" label="意见建议">
            <TextArea rows={3} placeholder="请输入您的意见和建议（选填）" />
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
        {caseData && (
          <CaseReceipt
            caseData={caseData}
            onClose={() => setReceiptVisible(false)}
          />
        )}
      </Modal>
    </div>
  );
}

export default CitizenCaseDetail;
