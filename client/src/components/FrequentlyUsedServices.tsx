import { Card, Row, Col, Button, Empty, Spin, Tag } from 'antd';
import { StarOutlined, CalendarOutlined, StarFilled, ThunderboltOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import type { ServiceItem } from '../types';
import AppointmentModal from './AppointmentModal';
import { useAuthStore } from '../store/auth';
import { useFavoriteStore } from '../store/favorite';
import { message } from 'antd';

interface FrequentlyUsedServicesProps {
  maxItems?: number;
  showTitle?: boolean;
  showViewAll?: boolean;
  showEmpty?: boolean;
  gutterBottom?: number;
}

function FrequentlyUsedServices({
  maxItems = 6,
  showTitle = true,
  showViewAll = true,
  showEmpty = false,
  gutterBottom = 16,
}: FrequentlyUsedServicesProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { favoritedIds, addFavorite, removeFavorite, loadFavorites } = useFavoriteStore();
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadRecommended();
      loadFavorites();
    }
  }, [isAuthenticated]);

  const loadRecommended = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/service/recommended', {
        params: { limit: maxItems },
      });
      setItems(res.items || []);
      setHasHistory(res.has_history || false);
    } catch (error) {
      console.error('加载常用事项失败:', error);
      setItems([]);
      setHasHistory(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAppointment = (service: ServiceItem) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setSelectedService(service);
    setAppointmentModalVisible(true);
  };

  const handleFavorite = async (service: ServiceItem, e: React.MouseEvent) => {
    e.stopPropagation();
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

  if (!isAuthenticated) {
    if (!showEmpty) return null;
    return (
      <Card
        title={
          showTitle ? (
            <span>
              <ThunderboltOutlined style={{ color: '#1677ff', marginRight: 8 }} />
              最近办理 / 常用事项
            </span>
          ) : null
        }
        style={{ marginBottom: gutterBottom }}
      >
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="登录后查看常用事项">
          <Button type="primary" onClick={() => navigate('/login')}>
            立即登录
          </Button>
        </Empty>
      </Card>
    );
  }

  if (!hasHistory && items.length === 0) {
    if (!showEmpty) return null;
    return (
      <Card
        title={
          showTitle ? (
            <span>
              <ThunderboltOutlined style={{ color: '#1677ff', marginRight: 8 }} />
              最近办理 / 常用事项
            </span>
          ) : null
        }
        extra={
          showViewAll ? (
            <Button type="link" onClick={() => navigate('/citizen/services')}>
              全部服务
            </Button>
          ) : null
        }
        style={{ marginBottom: gutterBottom }}
        loading={loading}
      >
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无常用事项">
          <Button type="primary" onClick={() => navigate('/citizen/services')}>
            去办理事项
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <>
      <Card
        title={
          showTitle ? (
            <span>
              <ThunderboltOutlined style={{ color: '#1677ff', marginRight: 8 }} />
              最近办理 / 常用事项
              {items.length > 0 && (
                <Tag color="blue" style={{ marginLeft: 8, fontWeight: 'normal' }}>
                  {items.length} 项
                </Tag>
              )}
            </span>
          ) : null
        }
        extra={
          showViewAll ? (
            <Button type="link" onClick={() => navigate('/citizen/services')}>
              全部服务
            </Button>
          ) : null
        }
        style={{ marginBottom: gutterBottom }}
        loading={loading}
      >
        {items.length > 0 ? (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col span={4} key={item.id}>
                <Card
                  hoverable
                  className="service-card"
                  onClick={() => handleAppointment(item)}
                  actions={[
                    <Button
                      key="favorite"
                      type="text"
                      size="small"
                      icon={
                        favoritedIds.has(item.id) ? (
                          <StarFilled style={{ color: '#faad14' }} />
                        ) : (
                          <StarOutlined />
                        )
                      }
                      loading={favoriteLoadingId === item.id}
                      onClick={(e) => handleFavorite(item, e)}
                    >
                      {favoritedIds.has(item.id) ? '已收藏' : '收藏'}
                    </Button>,
                    <Button
                      key="appointment"
                      type="text"
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppointment(item);
                      }}
                    >
                      预约
                    </Button>,
                  ]}
                >
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8, color: '#1677ff' }}>
                      ⚡
                    </div>
                    <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {item.department_name}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无常用事项" />
        )}
      </Card>

      <AppointmentModal
        open={appointmentModalVisible}
        service={selectedService}
        onCancel={() => setAppointmentModalVisible(false)}
        onSuccess={loadRecommended}
      />
    </>
  );
}

export default FrequentlyUsedServices;
