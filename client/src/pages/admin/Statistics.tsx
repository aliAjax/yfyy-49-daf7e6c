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

interface AppointmentConversionRow {
  id?: string;
  name: string;
  code?: string;
  department_name?: string;
  appointment_count: number;
  checked_in_count: number;
  case_count: number;
  completed_count: number;
  check_in_rate: number;
  case_rate: number;
  completion_rate: number;
}

interface AppointmentConversionTrend {
  date: string;
  appointment_count: number;
  checked_in_count: number;
  case_count: number;
  completed_count: number;
  check_in_rate: number;
  case_rate: number;
  completion_rate: number;
}

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
  const [appointmentConversion, setAppointmentConversion] = useState<{
    summary: AppointmentConversionRow;
    departments: AppointmentConversionRow[];
    serviceItems: AppointmentConversionRow[];
    trend: AppointmentConversionTrend[];
  }>({
    summary: {
      name: '全部',
      appointment_count: 0,
      checked_in_count: 0,
      case_count: 0,
      completed_count: 0,
      check_in_rate: 0,
      case_rate: 0,
      completion_rate: 0,
    },
    departments: [],
    serviceItems: [],
    trend: [],
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

      const [overviewRes, trendRes, deptRes, serviceRes, conversionRes] = await Promise.all([
        api.get('/statistics/overview', { params }),
        api.get('/statistics/trend', { params: { ...params, days: 30 } }),
        api.get('/statistics/by-department', { params }),
        api.get('/statistics/by-service-item', { params: { ...params, top: 10 } }),
        api.get('/statistics/appointment-conversion', { params }),
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
      setAppointmentConversion({
        summary: (conversionRes as any).summary || {
          name: '全部',
          appointment_count: 0,
          checked_in_count: 0,
          case_count: 0,
          completed_count: 0,
          check_in_rate: 0,
          case_rate: 0,
          completion_rate: 0,
        },
        departments: (conversionRes as any).departments || [],
        serviceItems: (conversionRes as any).service_items || [],
        trend: (conversionRes as any).trend || [],
      });

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

  const appointmentConversionTrendOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['预约数', '签到取号数', '形成办件数', '办结数'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: 48,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: appointmentConversion.trend.map((item) => dayjs(item.date).format('MM-DD')),
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
    },
    series: [
      {
        name: '预约数',
        type: 'line',
        smooth: true,
        data: appointmentConversion.trend.map((item) => item.appointment_count),
      },
      {
        name: '签到取号数',
        type: 'line',
        smooth: true,
        data: appointmentConversion.trend.map((item) => item.checked_in_count),
      },
      {
        name: '形成办件数',
        type: 'line',
        smooth: true,
        data: appointmentConversion.trend.map((item) => item.case_count),
      },
      {
        name: '办结数',
        type: 'line',
        smooth: true,
        data: appointmentConversion.trend.map((item) => item.completed_count),
      },
    ],
  };

  const renderRate = (rate: number) => {
    const color = rate >= 80 ? '#52c41a' : rate >= 50 ? '#faad14' : '#ff4d4f';
    return <Tag color={color}>{Number(rate || 0).toFixed(1)}%</Tag>;
  };

  const conversionColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '预约数',
      dataIndex: 'appointment_count',
      key: 'appointment_count',
      width: 90,
    },
    {
      title: '签到取号数',
      dataIndex: 'checked_in_count',
      key: 'checked_in_count',
      width: 110,
    },
    {
      title: '形成办件数',
      dataIndex: 'case_count',
      key: 'case_count',
      width: 110,
    },
    {
      title: '办结数',
      dataIndex: 'completed_count',
      key: 'completed_count',
      width: 90,
    },
    {
      title: '签到率',
      dataIndex: 'check_in_rate',
      key: 'check_in_rate',
      width: 90,
      render: renderRate,
    },
    {
      title: '办件转化率',
      dataIndex: 'case_rate',
      key: 'case_rate',
      width: 110,
      render: renderRate,
    },
    {
      title: '办结转化率',
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      width: 110,
      render: renderRate,
    },
  ];

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

      <Card title="预约转化率" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic title="预约数" value={appointmentConversion.summary.appointment_count} />
          </Col>
          <Col span={6}>
            <Statistic title="签到取号数" value={appointmentConversion.summary.checked_in_count} />
          </Col>
          <Col span={6}>
            <Statistic title="形成办件数" value={appointmentConversion.summary.case_count} />
          </Col>
          <Col span={6}>
            <Statistic
              title="办结转化率"
              value={appointmentConversion.summary.completion_rate}
              precision={1}
              suffix="%"
            />
          </Col>
        </Row>
        <ReactECharts option={appointmentConversionTrendOption} style={{ height: 320, marginBottom: 16 }} />
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>按科室统计</h3>
            <Table
              dataSource={appointmentConversion.departments}
              columns={conversionColumns.filter((column) => column.key !== 'department_name')}
              rowKey={(record) => record.id || record.name}
              pagination={false}
              size="small"
              scroll={{ x: 840 }}
            />
          </Col>
          <Col span={24}>
            <h3 style={{ fontSize: 16, margin: '8px 0 12px' }}>按服务事项统计</h3>
            <Table
              dataSource={appointmentConversion.serviceItems}
              columns={conversionColumns}
              rowKey={(record) => record.id || `${record.department_name}-${record.name}`}
              pagination={{ pageSize: 8 }}
              size="small"
              scroll={{ x: 960 }}
            />
          </Col>
        </Row>
      </Card>

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
