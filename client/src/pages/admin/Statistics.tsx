import { Card, Row, Col, Statistic, Select, DatePicker, Table, Tag, Space, Button } from 'antd';
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
import dayjs from 'dayjs';
import api from '../../api';

const { RangePicker } = DatePicker;

function Statistics() {
  const [loading, setLoading] = useState(false);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [overviewStats, setOverviewStats] = useState({
    total_cases: 0,
    today_cases: 0,
    processing_cases: 0,
    completed_cases: 0,
    avg_rating: 0,
    satisfaction_rate: 0,
    total_evaluations: 0,
  });
  const [trendData, setTrendData] = useState<{ dates: string[]; counts: number[] }>({
    dates: [],
    counts: [],
  });
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [serviceItemStats, setServiceItemStats] = useState<any[]>([]);
  const [satisfactionData, setSatisfactionData] = useState({
    satisfied: 0,
    dissatisfied: 0,
  });
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    loadDepartments();
    loadAllData();
  }, []);

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (departmentId) {
        params.department_id = departmentId;
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const [overviewRes, trendRes, deptRes, serviceRes] = await Promise.all([
        api.get('/statistics/overview', { params }),
        api.get('/statistics/trend', { params: { ...params, days: 30 } }),
        api.get('/statistics/by-department', { params }),
        api.get('/statistics/by-service-item', { params: { ...params, top: 10 } }),
      ]);

      setOverviewStats((overviewRes as any).stats || {
        total_cases: 0,
        today_cases: 0,
        processing_cases: 0,
        completed_cases: 0,
        avg_rating: 0,
        satisfaction_rate: 0,
        total_evaluations: 0,
      });

      const trend = (trendRes as any).trend || [];
      setTrendData({
        dates: trend.map((t: any) => dayjs(t.date).format('MM-DD')),
        counts: trend.map((t: any) => t.count),
      });

      setDepartmentStats((deptRes as any).departments || []);
      setServiceItemStats((serviceRes as any).service_items || []);

      setSatisfactionData({
        satisfied: Math.round(((overviewRes as any).stats?.satisfaction_rate || 0) / 100 * ((overviewRes as any).stats?.total_evaluations || 0)),
        dissatisfied: ((overviewRes as any).stats?.total_evaluations || 0) - Math.round(((overviewRes as any).stats?.satisfaction_rate || 0) / 100 * ((overviewRes as any).stats?.total_evaluations || 0)),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadAllData();
  };

  const handleReset = () => {
    setDepartmentId('');
    setDateRange(null);
    loadAllData();
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
      data: departmentStats.map((d) => d.name),
      axisLabel: {
        interval: 0,
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
    },
    legend: {
      data: ['总办件', '已完成', '办理中'],
      bottom: 0,
    },
    series: [
      {
        name: '总办件',
        type: 'bar',
        barWidth: '20%',
        itemStyle: {
          color: '#1890ff',
          borderRadius: [4, 4, 0, 0],
        },
        data: departmentStats.map((d) => d.total_count),
      },
      {
        name: '已完成',
        type: 'bar',
        barWidth: '20%',
        itemStyle: {
          color: '#52c41a',
          borderRadius: [4, 4, 0, 0],
        },
        data: departmentStats.map((d) => d.completed_count),
      },
      {
        name: '办理中',
        type: 'bar',
        barWidth: '20%',
        itemStyle: {
          color: '#faad14',
          borderRadius: [4, 4, 0, 0],
        },
        data: departmentStats.map((d) => d.processing_count),
      },
    ],
  };

  const satisfactionPieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '满意度',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
        },
        data: [
          { value: satisfactionData.satisfied, name: '满意', itemStyle: { color: '#52c41a' } },
          { value: satisfactionData.dissatisfied, name: '不满意', itemStyle: { color: '#ff4d4f' } },
        ],
      },
    ],
  };

  const serviceItemColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, record: any, index: number) => {
        const colors = ['#f5222d', '#fa8c16', '#faad14', '#d9d9d9', '#d9d9d9'];
        return (
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: index < 3 ? colors[index] : '#d9d9d9',
              color: index < 3 ? '#fff' : '#666',
              textAlign: 'center',
              lineHeight: '24px',
              fontWeight: 'bold',
            }}
          >
            {index + 1}
          </span>
        );
      },
    },
    {
      title: '服务事项',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '办件量',
      dataIndex: 'total_count',
      key: 'total_count',
      width: 100,
      render: (count: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{count}</span>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16}>
          <Select
            placeholder="选择科室"
            value={departmentId || undefined}
            onChange={setDepartmentId}
            style={{ width: 200 }}
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
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总办件数"
              value={overviewStats.total_cases}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日办件"
              value={overviewStats.today_cases}
              prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="办理中"
              value={overviewStats.processing_cases}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已完成"
              value={overviewStats.completed_cases}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均评分"
              value={overviewStats.avg_rating}
              precision={2}
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
              value={overviewStats.satisfaction_rate}
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
            <ReactECharts option={trendOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="满意度统计">
            <ReactECharts option={satisfactionPieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card title="科室办件排行">
            <ReactECharts option={deptBarOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="服务事项排行">
            <Table
              dataSource={serviceItemStats}
              columns={serviceItemColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Statistics;
