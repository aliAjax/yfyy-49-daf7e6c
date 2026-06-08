import { Card, Row, Col, Statistic, Button, List, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../api';
import type { ServiceItem } from '../../types';
import { CaseStatusText } from '../../types';
import dayjs from 'dayjs';

function CitizenHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({});
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [hotServices, setHotServices] = useState<ServiceItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [casesRes, servicesRes]: any = await Promise.all([
        api.get('/cases/my?pageSize=5'),
        api.get('/service/service-items/all'),
      ]);
      
      setRecentCases(casesRes.cases || []);
      setHotServices((servicesRes.items || []).slice(0, 6));

      const allCases = casesRes.cases || [];
      setStats({
        total: allCases.length,
        processing: allCases.filter((c: any) => !['completed', 'rejected'].includes(c.status)).length,
        completed: allCases.filter((c: any) => c.status === 'completed').length,
        appointments: 0,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      submitted: 'blue',
      material_reviewing: 'orange',
      material_correction: 'warning',
      accepting: 'processing',
      reviewing: 'processing',
      cross_department: 'purple',
      approved: 'success',
      rejected: 'error',
      completed: 'success',
    };
    return colorMap[status] || 'default';
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2>欢迎使用政务服务大厅</h2>
        <p style={{ color: '#666' }}>在线办理各类政务服务事项，省时省力</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="我的办件"
              value={stats.total || 0}
              prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="办理中"
              value={stats.processing || 0}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="我的预约"
              value={stats.appointments || 0}
              prefix={<CalendarOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="热门服务"
            extra={
              <Button type="link" onClick={() => navigate('/citizen/services')}>
                查看全部 <RightOutlined />
              </Button>
            }
          >
            <Row gutter={[16, 16]}>
              {hotServices.map((item) => (
                <Col span={8} key={item.id}>
                  <Card
                    hoverable
                    className="service-card"
                    onClick={() => navigate(`/citizen/services?item=${item.id}`)}
                  >
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{item.department_name}</div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="最近办件"
            extra={
              <Button type="link" onClick={() => navigate('/citizen/cases')}>
                查看全部 <RightOutlined />
              </Button>
            }
          >
            <List
              dataSource={recentCases}
              renderItem={(item: any) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/citizen/cases/${item.id}`)}
                >
                  <List.Item.Meta
                    title={item.case_number}
                    description={item.service_item_name}
                  />
                  <Space direction="vertical" align="end">
                    <Tag color={getStatusColor(item.status)}>
                      {CaseStatusText[item.status as keyof typeof CaseStatusText]}
                    </Tag>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {dayjs(item.created_at).format('MM-DD HH:mm')}
                    </span>
                  </Space>
                </List.Item>
              )}
            />
            {recentCases.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                暂无办件记录
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default CitizenHome;
