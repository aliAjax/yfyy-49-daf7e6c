import { Modal, Form, Input, DatePicker, List, Tag, Spin, Button, message, Radio, Row, Col, Statistic, Alert, Progress } from 'antd';
import { useState, useEffect } from 'react';
import api from '../api';
import type { ServiceItem } from '../types';
import { getServiceItemMaterialList, hasServiceItemMaterials } from '../utils/materials';
import dayjs from 'dayjs';

interface DateSlotInfo {
  date: string;
  total_count: number;
  booked_count: number;
  remaining_count: number;
  time_slots?: string;
}

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
  const [availableDates, setAvailableDates] = useState<DateSlotInfo[]>([]);
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);
  const [selectedDateInfo, setSelectedDateInfo] = useState<DateSlotInfo | null>(null);

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
    setSelectedDateInfo(null);

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

  const refreshAvailableDates = async () => {
    if (!service) return;
    try {
      const datesRes: any = await api.get('/service/available-dates', {
        params: { service_item_id: service.id },
      });
      setAvailableDates(datesRes.dates || []);
      const currentDateValue = form.getFieldValue('date');
      if (currentDateValue) {
        const dateStr = dayjs(currentDateValue).format('YYYY-MM-DD');
        const updated = datesRes.dates?.find((d: DateSlotInfo) => d.date === dateStr);
        setSelectedDateInfo(updated || null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDateChange = (date: any) => {
    if (!date) {
      setSelectedDateInfo(null);
      form.setFieldsValue({ time_slot: undefined });
      return;
    }
    const dateStr = date.format('YYYY-MM-DD');
    const info = availableDates.find((d) => d.date === dateStr);
    setSelectedDateInfo(info || null);
    form.setFieldsValue({ time_slot: undefined });
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
      await refreshAvailableDates();
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
    const available = availableDates.find((d) => d.date === dateStr);
    return !available || available.booked_count >= available.total_count;
  };

  const getTimeSlots = (): string[] => {
    if (!selectedDateInfo?.time_slots) return [];
    try {
      const parsed = JSON.parse(selectedDateInfo.time_slots);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getProgressPercent = () => {
    if (!selectedDateInfo || selectedDateInfo.total_count === 0) return 0;
    return Math.round((selectedDateInfo.booked_count / selectedDateInfo.total_count) * 100);
  };

  const timeSlots = getTimeSlots();
  const hasTimeSlots = timeSlots.length > 0;

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
      width={560}
      destroyOnClose
    >
      <Spin spinning={loading}>
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
              onChange={handleDateChange}
            />
          </Form.Item>

          {selectedDateInfo && (
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>号源信息</div>
              <Row gutter={16} style={{ marginBottom: 12 }}>
                <Col span={8}>
                  <Statistic
                    title="总号源"
                    value={selectedDateInfo.total_count}
                    valueStyle={{ fontSize: 20, color: '#1890ff' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="已预约"
                    value={selectedDateInfo.booked_count}
                    valueStyle={{ fontSize: 20, color: '#faad14' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="剩余号源"
                    value={selectedDateInfo.remaining_count}
                    valueStyle={{
                      fontSize: 20,
                      color: selectedDateInfo.remaining_count > 0 ? '#52c41a' : '#ff4d4f',
                    }}
                  />
                </Col>
              </Row>
              <Progress
                percent={getProgressPercent()}
                size="small"
                showInfo
                status={selectedDateInfo.remaining_count === 0 ? 'exception' : 'active'}
              />
              {selectedDateInfo.remaining_count === 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message="该日期号源已满"
                  description="请选择其他日期进行预约"
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
          )}

          {selectedDateInfo && selectedDateInfo.remaining_count > 0 && hasTimeSlots && (
            <Form.Item
              name="time_slot"
              label="选择时段"
              rules={[{ required: true, message: '请选择预约时段' }]}
            >
              <Radio.Group style={{ width: '100%' }}>
                <Row gutter={[8, 8]}>
                  {timeSlots.map((slot) => (
                    <Col span={12} key={slot}>
                      <Radio.Button value={slot} style={{ width: '100%', textAlign: 'center' }}>
                        {slot}
                      </Radio.Button>
                    </Col>
                  ))}
                </Row>
              </Radio.Group>
            </Form.Item>
          )}

          {selectedDateInfo && selectedDateInfo.remaining_count > 0 && !hasTimeSlots && (
            <Form.Item name="time_slot" label="选择时段">
              <div style={{ color: '#999', fontSize: 13 }}>该日期未配置时段，无需选择</div>
            </Form.Item>
          )}

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
            </div>
          )}
        </Form>
      </Spin>
    </Modal>
  );
}

export default AppointmentModal;
