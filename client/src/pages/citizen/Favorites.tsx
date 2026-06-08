import { Card, Row, Col, Button, message, Spin, Empty, Tag, List } from 'antd';
import { StarFilled, StarOutlined, CalendarOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';
import api from '../../api';
import type { ServiceItem } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useFavoriteStore } from '../../store/favorite';

function CitizenFavorites() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { favorites, loading: favoritesLoading, removeFavorite } = useFavoriteStore();
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  const handleRemoveFavorite = async (service: ServiceItem) => {
    setRemoveLoading(service.id);
    try {
      await removeFavorite(service.id);
      message.success('已取消收藏');
    } catch (error) {
      console.error(error);
    } finally {
      setRemoveLoading(null);
    }
  };

  const handleViewDetail = (service: ServiceItem) => {
    navigate(`/citizen/services?item=${service.id}`);
  };

  const handleAppointment = (service: ServiceItem) => {
    navigate(`/citizen/services?item=${service.id}`);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请先登录后查看收藏"
        >
          <Button type="primary" onClick={() => navigate('/login')}>
            立即登录
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <Card
        title={
          <span>
            <StarFilled style={{ color: '#faad14', marginRight: 8 }} />
            我的收藏
            <Tag color="blue" style={{ marginLeft: 12 }}>
              共 {favorites.length} 项
            </Tag>
          </span>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Button type="primary" onClick={() => navigate('/citizen/services')}>
            去收藏更多
          </Button>
        }
      >
        <Spin spinning={favoritesLoading}>
          {favorites.length > 0 ? (
            <Row gutter={[16, 16]}>
              {favorites.map((item) => (
                <Col span={8} key={item.id}>
                  <Card
                    hoverable
                    className="service-card"
                    title={item.name}
                    extra={<span style={{ fontSize: 12, color: '#999' }}>{item.code}</span>}
                    actions={[
                      <Button
                        key="detail"
                        type="text"
                        icon={<InfoCircleOutlined />}
                        onClick={() => handleViewDetail(item)}
                      >
                        查看详情
                      </Button>,
                      <Button
                        key="appointment"
                        type="text"
                        icon={<CalendarOutlined />}
                        onClick={() => handleAppointment(item)}
                      >
                        立即预约
                      </Button>,
                      <Button
                        key="unfavorite"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={removeLoading === item.id}
                        onClick={() => handleRemoveFavorite(item)}
                      >
                        取消收藏
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
          ) : (
            <div style={{ padding: '60px 0' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无收藏的服务事项"
              >
                <Button
                  type="primary"
                  icon={<StarOutlined />}
                  onClick={() => navigate('/citizen/services')}
                >
                  去收藏常用事项
                </Button>
              </Empty>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
}

export default CitizenFavorites;
