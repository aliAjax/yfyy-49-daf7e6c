import { Button, Card, Col, Empty, Row, Space, Spin, message } from 'antd';
import { CalendarOutlined, StarFilled } from '@ant-design/icons';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavoriteStore } from '../../store/favorites';

function CitizenFavorites() {
  const navigate = useNavigate();
  const { favoriteServices, loading, loadFavorites, setFavorite } = useFavoriteStore();

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleCancelFavorite = async (serviceItemId: string) => {
    await setFavorite(serviceItemId, false);
    message.success('已取消收藏');
  };

  return (
    <div>
      <Card
        title="我的收藏"
        extra={
          <Button type="primary" onClick={() => navigate('/citizen/services')}>
            添加常用服务
          </Button>
        }
      >
        <Spin spinning={loading}>
          {favoriteServices.length > 0 ? (
            <Row gutter={[16, 16]}>
              {favoriteServices.map((item) => (
                <Col span={8} key={item.id}>
                  <Card
                    hoverable
                    className="service-card"
                    title={item.name}
                    extra={<StarFilled style={{ color: '#faad14' }} />}
                  >
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                      {item.code}
                    </div>
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
                      <Button style={{ width: '42%' }} onClick={() => handleCancelFavorite(item.id)}>
                        取消收藏
                      </Button>
                      <Button
                        type="primary"
                        style={{ width: '58%' }}
                        icon={<CalendarOutlined />}
                        onClick={() => navigate(`/citizen/services?item=${item.id}`)}
                      >
                        去预约
                      </Button>
                    </Space.Compact>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="暂无收藏的常用服务" style={{ padding: '48px 0' }}>
              <Button type="primary" onClick={() => navigate('/citizen/services')}>
                去收藏服务事项
              </Button>
            </Empty>
          )}
        </Spin>
      </Card>
    </div>
  );
}

export default CitizenFavorites;
