import { Modal, Form, Input, DatePicker, List, Tag, Spin, Button, message } from 'antd';
import { useState, useEffect } from 'react';
import api from '../api';
import type { ServiceItem } from '../types';
import { getServiceItemMaterialList, hasServiceItemMaterials } from '../utils/materials';
import dayjs from 'dayjs';

interface AppointmentModalProps {
  open: boolean;
  service: ServiceItem | null;
  onCancel: () => void;
  onSuccess?: () => void;
}

function AppointmentModal({ open, service, onCancel, onSuccess }: AppointmentModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);

  useEffect(() => {
    if (open && service) {
      loadData();
    }
  }, [open, service]);

  const loadData = async () => {
    if (!service) return;
    setLoading(true);
    form.resetFields();
    setDetailService(null);

    try {
      const [detailRes, datesRes]: any = await Promise.all([
        api.get(`/service/service-items/${service.id}`),
        api.get('/service/available-dates', {
          params: { service_item_id: service.id },
        }),
      ]);
      if (detailRes.item) {
        setDetailService(detailRes.item);
      }
      setAvailableDates(datesRes.dates || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await api.post('/appointments', {
        service_item_id: detailService?.id || service?.id,
        appointment_date: dayjs(values.date).format('YYYY-MM-DD'),
        time_slot: values.time_slot,
        applicant_name: values.applicant_name,
        applicant_phone: values.applicant_phone,
        remark: values.remark,
      });

      message.success('预约成功');
      onCancel();
      form.resetFields();
      onSuccess?.();
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

  return (
    <Modal
      title={`预约 - ${detailService?.name || service?.name || ''}`}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          提交预约
        </Button>,
      ]}
      width={500}
      destroyOnClose
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
        {detailService && hasServiceItemMaterials(detailService) && (
          <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 6 }}>
            <div style={{ fontWeight: 500, marginBottom: 12 }}>
              <span>所需材料</span>
              <Tag color="blue" style={{ marginLeft: 8 }}>
                共 {getServiceItemMaterialList(detailService).length} 项
              </Tag>
            </div>
            <Spin spinning={loading}>
              <List
                size="small"
                dataSource={getServiceItemMaterialList(detailService)}
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
  );
}

export default AppointmentModal;
