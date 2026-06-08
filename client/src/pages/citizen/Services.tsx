import { Card, Row, Col, Input, Select, Button, Modal, Form, DatePicker, message, Spin, Space, Empty } from 'antd';
import { SearchOutlined, CalendarOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { ServiceItem } from '../../types';
import dayjs from 'dayjs';
import { useFavoriteStore } from '../../store/favorites';
import { useSearchParams } from 'react-router-dom';

function CitizenServices() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { favoriteIds, loadFavorites, setFavorite } = useFavoriteStore();

  useEffect(() => {
    loadFavorites();
    loadServices();
    loadDepartments();
  }, []);

  useEffect(() => {
    const serviceItemId = searchParams.get('item');
    if (!serviceItemId || services.length === 0 || modalVisible) {
      return;
    }
    const service = services.find((item) => item.id === serviceItemId);
    if (service) {
      handleAppointment(service);
    }
  }, [searchParams, services, modalVisible]);

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
    try {
      const res: any = await api.get(`/service/service-items/${service.id}`);
      setSelectedService(res.item);
    } catch (error) {
      console.error(error);
      setSelectedService(service);
    }
    setModalVisible(true);
    form.resetFields();
    
    try {
      const res: any = await api.get('/service/available-dates', {
        params: { service_item_id: service.id },
      });
      setAvailableDates(res.dates || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleFavorite = async (service: ServiceItem) => {
    const nextFavorite = !isServiceFavorite(service);
    await setFavorite(service.id, nextFavorite);
    setServices((list) =>
      list.map((item) =>
        item.id === service.id ? { ...item, is_favorite: nextFavorite ? 1 : 0 } : item
      )
    );
    if (selectedService?.id === service.id) {
      setSelectedService({ ...selectedService, is_favorite: nextFavorite ? 1 : 0 });
    }
    message.success(nextFavorite ? '已收藏' : '已取消收藏');
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

  const parseMaterials = (materials: string) => {
    try {
      return JSON.parse(materials);
    } catch {
      return [];
    }
  };

  const isServiceFavorite = (service: ServiceItem) =>
    favoriteIds.includes(service.id) || service.is_favorite === 1;

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
                extra={
                  <Button
                    type="text"
                    icon={
                      isServiceFavorite(item) ? (
                        <StarFilled style={{ color: '#faad14' }} />
                      ) : (
                        <StarOutlined />
                      )
                    }
                    onClick={() => handleToggleFavorite(item)}
                  />
                }
              >
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{item.code}</div>
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
                <Space.Compact style={{ width: '100%' }}>
                  <Button
                    style={{ width: '42%' }}
                    icon={isServiceFavorite(item) ? <StarFilled /> : <StarOutlined />}
                    onClick={() => handleToggleFavorite(item)}
                  >
                    {isServiceFavorite(item) ? '取消收藏' : '收藏'}
                  </Button>
                  <Button
                    type="primary"
                    style={{ width: '58%' }}
                    icon={<CalendarOutlined />}
                    onClick={() => handleAppointment(item)}
                  >
                    立即预约
                  </Button>
                </Space.Compact>
              </Card>
            </Col>
          ))}
        </Row>
        {services.length === 0 && (
          <Empty description="暂无服务事项" style={{ padding: '48px 0' }} />
        )}
      </Spin>

      <Modal
        title={`预约 - ${selectedService?.name}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="favorite"
            icon={selectedService && isServiceFavorite(selectedService) ? <StarFilled /> : <StarOutlined />}
            onClick={() => selectedService && handleToggleFavorite(selectedService)}
          >
            {selectedService && isServiceFavorite(selectedService) ? '取消收藏' : '收藏'}
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
          {selectedService?.materials && (
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>所需材料：</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {parseMaterials(selectedService.materials).map((m: any, index: number) => (
                  <li key={index} style={{ marginBottom: 4 }}>
                    {m.name} {m.required && <span style={{ color: '#ff4d4f' }}>*</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default CitizenServices;
