import { Card, Row, Col, Statistic, Table, Tag, Spin } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  StarOutlined,
  SmileOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import api from '../../api';
import type { Case } from '../../types';
import { CaseStatusText } from '../../types';

function AdminDashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total_cases: 0,
    today_cases: 0,
    processing_cases: 0,
    completed_cases: 0,
    avg_rating: 0,
    satisfaction_rate: 0,
  });
  const [trendData, setTrendData] = useState<{ dates: string[]; counts: number[] }>({
    dates: [],
    counts: [],
  });
  const [departmentStats, setDepartmentStats] = useState<{ names: string[]; counts: number[] }>({
    names: [],
    counts: [],
  });
  const [recentCases, setRecentCases] = useState<Case[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, trendRes, deptRes, casesRes]: any = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/trend'),
        api.get('/dashboard/department-stats'),
        api.get('/dashboard/recent-cases'),
      ]);

      setStats(statsRes || {
        total_cases: 0,
        today_cases: 0,
        processing_cases: 0,
        completed_cases: 0,
        avg_rating: 0,
        satisfaction_rate: 0,
      });

      setTrendData(trendRes || { dates: [], counts: [] });
      setDepartmentStats(deptRes || { names: [], counts: [] });
      setRecentCases(casesRes?.cases || []);
    } catch (error) {
      console.error(error);
      const mockDates = ['1月', '2月', '3月', '4月', '5月', '6月', '7月'];
      const mockCounts = [120, 190, 150, 220, 280, 250, 310];
      setTrendData({ dates: mockDates, counts: mockCounts });

      const mockDepts = ['综合科', '户籍科', '社保科', '医保科', '不动产科'];
      const mockDeptCounts = [150, 230, 180, 210, 160];
      setDepartmentStats({ names: mockDepts, counts: mockDeptCounts });
    } finally {
      setLoading(false);
    }
  };

  const trendOption = {
    tooltip: {
      trigger: 'axis',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.dates,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '办件数',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
            ],
          },
        },
        lineStyle: {
          color: '#1890ff',
          width: 2,
        },
        itemStyle: {
          color: '#1890ff',
        },
        data: trendData.counts,
      },
    ],
  };

  const deptBarOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: departmentStats.names,
      axisLabel: {
        interval: 0,
        rotate: 0,
      },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '办件数',
        type: 'bar',
        barWidth: '50%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#1890ff' },
              { offset: 1, color: '#69c0ff' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        data: departmentStats.counts,
      },
    ],
  };

  const columns = [
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 140,
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100,
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : 'blue'}>
          {CaseStatusText[status as keyof typeof CaseStatusText] || status}
        </Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
  ];

  return (
    <Spin spinning={loading}>
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="总办件数"
                value={stats.total_cases}
                prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="今日办件"
                value={stats.today_cases}
                prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="办理中"
                value={stats.processing_cases}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已完成"
                value={stats.completed_cases}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="平均评分"
                value={stats.avg_rating}
                precision={1}
                prefix={<StarOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
                suffix="分"
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="满意度"
                value={stats.satisfaction_rate}
                precision={1}
                prefix={<SmileOutlined style={{ color: '#13c2c2' }} />}
                valueStyle={{ color: '#13c2c2' }}
                suffix="%"
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={16}>
            <Card title="办件趋势">
              <ReactECharts option={trendOption} style={{ height: 300 }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card title="各科室办件统计">
              <ReactECharts option={deptBarOption} style={{ height: 300 }} />
            </Card>
          </Col>
        </Row>

        <Card title="最新办件">
          <Table
            columns={columns}
            dataSource={recentCases}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    </Spin>
  );
}

export default AdminDashboard;
