import { Card, Row, Col, Input, Select, Button, Modal, message, Spin, Tag, Descriptions, List } from 'antd';
import { SearchOutlined, CalendarOutlined, InfoCircleOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { ServiceItem } from '../../types';
import { getServiceItemMaterialList, hasServiceItemMaterials } from '../../utils/materials';
import { useAuthStore } from '../../store/auth';
import { useFavoriteStore } from '../../store/favorite';
import FrequentlyUsedServices from '../../components/FrequentlyUsedServices';
import AppointmentModal from '../../components/AppointmentModal';

function CitizenServices() {
  const { isAuthenticated } = useAuthStore();
  const { favoritedIds, addFavorite, removeFavorite, loading: favoriteLoading } = useFavoriteStore();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null);

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

  const handleFavorite = async (service: ServiceItem) => {
    if (!isAuthenticated) {
      message.info('请先登录后再收藏');
      return;
    }
    if (service.status !== 'active') {
      message.warning('该服务事项已停用，无法收藏');
      return;
    }

    const isFavorited = favoritedIds.has(service.id);
    setFavoriteLoadingId(service.id);

    try {
      if (isFavorited) {
        await removeFavorite(service.id);
        message.success('已取消收藏');
      } else {
        await addFavorite(service.id);
        message.success('收藏成功');
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setFavoriteLoadingId(null);
    }
  };

  const handleAppointment = (service: ServiceItem) => {
    setSelectedService(service);
    setAppointmentModalVisible(true);
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
      <FrequentlyUsedServices maxItems={6} showViewAll={false} />

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
                  <span style={{ fontSize: 12, color: '#999' }}>{item.code}</span>
                }
                actions={[
                  <Button
                    type="text"
                    icon={<InfoCircleOutlined />}
                    onClick={() => handleViewDetail(item)}
                  >
                    查看详情
                  </Button>,
                  <Button
                    type="text"
                    icon={<CalendarOutlined />}
                    onClick={() => handleAppointment(item)}
                  >
                    立即预约
                  </Button>,
                  <Button
                    type="text"
                    icon={favoritedIds.has(item.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                    loading={favoriteLoadingId === item.id}
                    onClick={() => handleFavorite(item)}
                  >
                    {favoritedIds.has(item.id) ? '已收藏' : '收藏'}
                  </Button>,
                ]}
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
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <AppointmentModal
        open={appointmentModalVisible}
        service={selectedService}
        onCancel={() => setAppointmentModalVisible(false)}
        onSuccess={loadServices}
      />

      <Modal
        title="服务事项详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          isAuthenticated && detailService && detailService.status === 'active' && (
            <Button
              key="favorite"
              icon={favoritedIds.has(detailService.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              loading={favoriteLoadingId === detailService.id}
              onClick={() => detailService && handleFavorite(detailService)}
            >
              {favoritedIds.has(detailService.id) ? '已收藏' : '收藏'}
            </Button>
          ),
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
                <Descriptions.Item label="状态">
                  <Tag color={detailService.status === 'active' ? 'green' : 'default'}>
                    {detailService.status === 'active' ? '启用' : '停用'}
                  </Tag>
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
