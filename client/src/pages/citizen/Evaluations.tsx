import { Card, List, Rate, Tag, Spin } from 'antd';
import { StarOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import type { Evaluation } from '../../types';
import dayjs from 'dayjs';

function CitizenEvaluations() {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    loadEvaluations();
  }, [pagination.current, pagination.pageSize]);

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/evaluations/my', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
        },
      });
      setEvaluations(res.evaluations || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getSatisfactionTag = (isSatisfied: number) => {
    return isSatisfied === 1 ? (
      <Tag color="green">满意</Tag>
    ) : (
      <Tag color="red">不满意</Tag>
    );
  };

  return (
    <div>
      <Card title="我的评价">
      <Spin spinning={loading}>
        <List
          dataSource={evaluations}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/citizen/cases/${item.case_id}`)}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{item.service_item_name}</span>
                {getSatisfactionTag(item.is_satisfied)}
              </div>
                }
                description={
                  <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ marginRight: 8 }}>综合评分：</span>
                  <Rate disabled value={item.overall_rating} character={<StarOutlined />} />
                  <span style={{ marginLeft: 8, color: '#faad14' }}>{item.overall_rating} 分</span>
                </div>
                {item.comment && (
                  <div style={{ color: '#666', marginBottom: 8 }}>
                    {item.comment}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#999' }}>
                  办件编号：{item.case_number}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  评价时间：{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </div>
            }
              />
            </List.Item>
          )}
        />
        {evaluations.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            暂无评价记录
          </div>
        )}
      </Spin>
      </Card>
    </div>
  );
}

export default CitizenEvaluations;
