import { Card, Row, Col, Input, Select, Button, Modal, Form, DatePicker, message, Spin, Tag, Descriptions, Space, List } from 'antd';
import { SearchOutlined, CalendarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { ServiceItem, ServiceItemMaterial } from '../../types';
import { getServiceItemMaterialList, hasServiceItemMaterials } from '../../utils/materials';
import dayjs from 'dayjs';

function CitizenServices() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadServices();
    loadDepartments();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/service/service-items/all');
      let list = res.items || [];
      if (keyword) {
        list = list.filter((s: ServiceItem) =>
          s.name.includes(keyword) || s.code.includes(keyword)
        );
      }
      if (departmentId) {
        list = list.filter((s: ServiceItem) => s.department_id === departmentId);
      }
      setServices(list);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAppointment = async (service: ServiceItem) => {
    setSelectedService(service);
    setModalVisible(true);
    form.resetFields();
    setModalLoading(true);

    try {
      const [detailRes, datesRes]: any = await Promise.all([
        api.get(`/service/service-items/${service.id}`),
        api.get('/service/available-dates', {
          params: { service_item_id: service.id },
        }),
      ]);
      if (detailRes.item) {
        setSelectedService(detailRes.item);
      }
      setAvailableDates(datesRes.dates || []);
    } catch (error) {
      console.error(error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmitAppointment = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      await api.post('/appointments', {
        service_item_id: selectedService?.id,
        appointment_date: dayjs(values.date).format('YYYY-MM-DD'),
        time_slot: values.time_slot,
        applicant_name: values.applicant_name,
        applicant_phone: values.applicant_phone,
        remark: values.remark,
      });

      message.success('预约成功');
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const disabledDate = (current: any) => {
    if (!current) return false;
    const dateStr = current.format('YYYY-MM-DD');
    const available = availableDates.find((d: any) => d.date === dateStr);
    return !available || available.booked_count >= available.total_count;
  };

  const handleViewDetail = async (service: ServiceItem) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res: any = await api.get(`/service/service-items/${service.id}`);
      setDetailService(res.item);
    } catch (error) {
      console.error(error);
      setDetailService(service);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="搜索服务事项"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={loadServices}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择科室"
              style={{ width: '100%' }}
              value={departmentId}
              onChange={setDepartmentId}
              allowClear
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Col>
          <Col>
            <Button type="primary" onClick={loadServices}>
              搜索
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {services.map((item) => (
            <Col span={8} key={item.id}>
              <Card
                hoverable
                className="service-card"
                title={item.name}
                extra={<span style={{ fontSize: 12, color: '#999' }}>{item.code}</span>}
              >
                <div style={{ minHeight: 60, marginBottom: 12 }}>
                  <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>
                    {item.description || '暂无描述'}
                  </p>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                  <span>办理科室：{item.department_name}</span>
                  <br />
                  <span>办理时限：{item.processing_time || '3'} 个工作日</span>
                  <br />
                  <span>费用：{item.fee ? `¥${item.fee}` : '免费'}</span>
                </div>
                <Space style={{ width: '100%' }}>
                  <Button
                    style={{ flex: 1 }}
                    icon={<InfoCircleOutlined />}
                    onClick={() => handleViewDetail(item)}
                  >
                    查看详情
                  </Button>
                  <Button
                    type="primary"
                    style={{ flex: 1 }}
                    icon={<CalendarOutlined />}
                    onClick={() => handleAppointment(item)}
                  >
                    立即预约
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <Modal
        title={`预约 - ${selectedService?.name}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmitAppointment}>
            提交预约
          </Button>,
        ]}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="date"
            label="预约日期"
            rules={[{ required: true, message: '请选择预约日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={disabledDate}
              placeholder="选择预约日期"
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
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可选，填写备注信息" />
          </Form.Item>
          {selectedService && hasServiceItemMaterials(selectedService) && (
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>
                <span>所需材料</span>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  共 {getServiceItemMaterialList(selectedService).length} 项
                </Tag>
              </div>
              <Spin spinning={modalLoading}>
                <List
                  size="small"
                  dataSource={getServiceItemMaterialList(selectedService)}
                  renderItem={(item) => (
                    <List.Item key={item.id}>
                  <List.Item.Meta
                    title={
                      <span>
                        {item.is_required ? (
                          <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
                        ) : null}
                        {item.name}
                      </span>
                    }
                    description={
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {item.description && <div>{item.description}</div>}
                        {item.example && (
                          <div style={{ marginTop: 4, color: '#999' }}>
                            示例：{item.example}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
                  )}
                />
              </Spin>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="服务事项详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button
            key="appointment"
            type="primary"
            icon={<CalendarOutlined />}
            onClick={() => {
              if (detailService) {
                setDetailVisible(false);
                handleAppointment(detailService);
              }
            }}
          >
            立即预约
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <Spin spinning={detailLoading}>
          {detailService && (
            <div>
              <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="事项名称">{detailService.name}</Descriptions.Item>
                <Descriptions.Item label="事项编码">{detailService.code}</Descriptions.Item>
                <Descriptions.Item label="办理科室">{detailService.department_name}</Descriptions.Item>
                <Descriptions.Item label="办理窗口">{detailService.window_name || '待定'}</Descriptions.Item>
                <Descriptions.Item label="办理时限">
                  {detailService.processing_time || '3'} 个工作日
                </Descriptions.Item>
                <Descriptions.Item label="费用">
                  {detailService.fee ? `¥${detailService.fee}` : '免费'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>事项描述</div>
                <div style={{ color: '#666', lineHeight: 1.6 }}>
                  {detailService.description || '暂无描述'}
                </div>
              </div>

              {detailService && hasServiceItemMaterials(detailService) && (
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 12 }}>
                  <span>所需材料</span>
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    共 {getServiceItemMaterialList(detailService).length} 项
                  </Tag>
                </div>
                <List
                  dataSource={getServiceItemMaterialList(detailService)}
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
              </div>
            )}
          </div>
        )}
        </Spin>
      </Modal>
    </div>
  );
}

export default CitizenServices;
