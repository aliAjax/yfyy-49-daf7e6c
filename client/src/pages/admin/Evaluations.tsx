import { Card, Table, Button, Select, Input, Tag, message, Space, Rate, Row, Col, Statistic, Progress } from 'antd';
import { SearchOutlined, StarOutlined, SmileOutlined, FileTextOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { Evaluation, Department, ServiceItem } from '../../types';

function Evaluations() {
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [rating, setRating] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    avg_rating: 0,
    satisfaction_rate: 0,
    satisfied_count: 0,
    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  useEffect(() => {
    loadDepartments();
    loadServiceItems();
    loadEvaluations();
    loadStats();
  }, [page, pageSize]);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadServiceItems = async () => {
    try {
      const res: any = await api.get('/service/service-items/all');
      setServiceItems(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
      };
      if (rating) params.rating = rating;
      if (departmentId) params.department_id = departmentId;
      if (keyword) params.keyword = keyword;

      const res: any = await api.get('/evaluations', { params });
      setEvaluations(res.evaluations || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res: any = await api.get('/evaluations/stats/summary');
      setStats(res.stats || {
        total: 0,
        avg_rating: 0,
        satisfaction_rate: 0,
        satisfied_count: 0,
        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadEvaluations();
    loadStats();
  };

  const handleReset = () => {
    setRating('');
    setDepartmentId('');
    setKeyword('');
    setPage(1);
    loadEvaluations();
    loadStats();
  };

  const getRatingDistribution = () => {
    const dist = stats.rating_distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total = Object.values(dist).reduce((sum: number, val: any) => sum + val, 0) as number;
    return Object.entries(dist)
      .reverse()
      .map(([star, count]) => ({
        star: Number(star),
        count: count as number,
        percent: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
      }));
  };

  const columns = [
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 160,
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
      width: 150,
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '评分',
      dataIndex: 'overall_rating',
      key: 'overall_rating',
      width: 150,
      render: (rating: number) => (
        <Space>
          <Rate disabled value={rating} style={{ fontSize: 14 }} />
          <span style={{ color: '#faad14', fontWeight: 'bold' }}>{rating}分</span>
        </Space>
      ),
    },
    {
      title: '满意度',
      dataIndex: 'is_satisfied',
      key: 'is_satisfied',
      width: 100,
      render: (satisfied: number) => (
        <Tag color={satisfied === 1 ? 'green' : 'red'}>
          {satisfied === 1 ? '满意' : '不满意'}
        </Tag>
      ),
    },
    {
      title: '评价内容',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '评价时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总评价数"
              value={stats.total}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均评分"
              value={stats.avg_rating}
              precision={2}
              prefix={<StarOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
              suffix="分"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="满意度"
              value={stats.satisfaction_rate}
              precision={1}
              prefix={<SmileOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="满意数"
              value={stats.satisfied_count}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="评分分布">
            {getRatingDistribution().map((item) => (
              <div key={item.star} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 60 }}>{item.star} 星</span>
                <Progress
                  percent={item.percent}
                  showInfo={false}
                  size="small"
                  strokeColor="#faad14"
                  style={{ flex: 1, margin: '0 8px' }}
                />
                <span style={{ width: 60, textAlign: 'right', color: '#999' }}>{item.count}条</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={16}>
          <Card style={{ marginBottom: 16 }}>
            <Space size={16} wrap>
              <Input
                placeholder="搜索办件编号/评价内容"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 220 }}
                allowClear
                onPressEnter={handleSearch}
              />
              <Select
                placeholder="选择评分"
                value={rating || undefined}
                onChange={setRating}
                style={{ width: 120 }}
                allowClear
              >
                <Select.Option value="5">5星</Select.Option>
                <Select.Option value="4">4星</Select.Option>
                <Select.Option value="3">3星</Select.Option>
                <Select.Option value="2">2星</Select.Option>
                <Select.Option value="1">1星</Select.Option>
              </Select>
              <Select
                placeholder="选择科室"
                value={departmentId || undefined}
                onChange={setDepartmentId}
                style={{ width: 150 }}
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {departments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Select.Option>
                ))}
              </Select>
              <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Card>

          <Card title="评价列表">
            <Table
              columns={columns}
              dataSource={evaluations}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1000 }}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setPage(page);
                  setPageSize(pageSize);
                },
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Evaluations;
