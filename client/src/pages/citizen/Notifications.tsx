import { Card, List, Tag, Button, Space, Empty, Spin, Radio, message, Drawer, Checkbox, Divider, Alert } from 'antd';
import {
  BellOutlined,
  FileTextOutlined,
  CalendarOutlined,
  StarOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  RightOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import type { Notification } from '../../types';
import dayjs from 'dayjs';

const NotificationTypeText: Record<string, string> = {
  case: '办件通知',
  appointment: '预约通知',
  evaluation: '评价通知',
};

const NotificationTypeIcon: Record<string, React.ReactNode> = {
  case: <FileTextOutlined />,
  appointment: <CalendarOutlined />,
  evaluation: <StarOutlined />,
};

const NotificationTypeColor: Record<string, string> = {

  case: 'blue',
  appointment: 'green',
  evaluation: 'orange',
};

const SubTypeActionText: Record<string, string> = {
  appointment_confirmed: '查看预约',
  case_accepted: '查看办件',
  case_approved: '查看办件',
  case_rejected: '查看办件',
  case_completed_pending_evaluation: '去评价',
  case_material_correction: '补充材料',
  evaluation_reminder: '去评价',
  case_collaboration_received: '查看办件',
  case_collaboration_returned: '查看办件',
  case_collaboration_completed: '查看办件',
  case_reviewing: '查看办件',
};

interface CitizenNotificationsProps {
  onUnreadCountChange?: () => void;
}

function CitizenNotifications({ onUnreadCountChange }: CitizenNotificationsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<Notification | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [jumpTipVisible, setJumpTipVisible] = useState(false);
  const [jumpTipMessage, setJumpTipMessage] = useState('');

  useEffect(() => {
    loadNotifications();
  }, [type, onlyUnread, pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (location.pathname === '/citizen/notifications' && onUnreadCountChange) {
      onUnreadCountChange();
    }
  }, [location.pathname, onUnreadCountChange]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      if (onlyUnread) {
        params.is_read = 0;
      }
      if (type !== 'all') {
        params.type = type;
      }
      const res: any = await api.get('/notifications/my', { params });
      setNotifications(res.notifications || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
      setSelectedIds([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUnreadCount = () => {
    if (onUnreadCountChange) {
      onUnreadCountChange();
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      message.success('标记为已读');
      loadNotifications();
      refreshUnreadCount();
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      message.success('全部标记为已读');
      loadNotifications();
      refreshUnreadCount();
    } catch (error) {
      console.error(error);
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要标记的通知');
      return;
    }
    try {
      await api.post('/notifications/batch-read', { ids: selectedIds });
      message.success(`已将 ${selectedIds.length} 条通知标记为已读`);
      loadNotifications();
      refreshUnreadCount();
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewDetail = async (item: Notification) => {
    setDetailVisible(true);
    setCurrentDetail(item);
    setJumpTipVisible(false);
    if (item.is_read === 0) {
      try {
        await api.post(`/notifications/${item.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n))
        );
        refreshUnreadCount();
      } catch (error) {
        console.error(error);
      }
    }
    try {
      setDetailLoading(true);
      const res: any = await api.get(`/notifications/${item.id}`);
      if (res.notification) {
        setCurrentDetail(res.notification);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const validateRelatedData = async (item: Notification): Promise<boolean> => {
    if (!item.related_id) {
      return false;
    }
    try {
      if (item.type === 'case' || item.sub_type?.startsWith('case_') || item.sub_type === 'evaluation_reminder') {
        await api.get(`/cases/${item.related_id}`);
        return true;
      }
      if (item.type === 'appointment' || item.sub_type?.startsWith('appointment_')) {
        await api.get(`/appointments/${item.related_id}`);
        return true;
      }
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        return false;
      }
    }
    return false;
  };

  const getTipMessage = (item: Notification): string => {
    if (!item.related_id) {
      return '该通知暂未关联具体业务数据，您可以在此查看通知详情。';
    }
    if (item.type === 'case' || item.sub_type?.startsWith('case_') || item.sub_type === 'evaluation_reminder') {
      return '关联的办件数据不存在或您暂无权限查看，您可以在此查看通知详情。';
    }
    if (item.type === 'appointment' || item.sub_type?.startsWith('appointment_')) {
      return '关联的预约数据不存在或您暂无权限查看，您可以在此查看通知详情。';
    }
    return '关联的业务数据不存在，您可以在此查看通知详情。';
  };

  const handleJumpToRelated = async (item: Notification) => {
    const subType = item.sub_type || '';

    if (!item.related_id) {
      setJumpTipMessage(getTipMessage(item));
      setJumpTipVisible(true);
      if (!detailVisible) {
        setDetailVisible(true);
        setCurrentDetail(item);
      }
      return;
    }

    const dataExists = await validateRelatedData(item);
    if (!dataExists) {
      setJumpTipMessage(getTipMessage(item));
      setJumpTipVisible(true);
      if (!detailVisible) {
        setDetailVisible(true);
        setCurrentDetail(item);
      }
      return;
    }

    if (subType === 'appointment_confirmed') {
      navigate('/citizen/appointments');
      return;
    }

    if (
      subType === 'case_completed_pending_evaluation' ||
      subType === 'evaluation_reminder'
    ) {
      navigate(`/citizen/cases/${item.related_id}?evaluate=true`);
      return;
    }

    if (
      subType === 'case_accepted' ||
      subType === 'case_approved' ||
      subType === 'case_rejected' ||
      subType === 'case_material_correction' ||
      subType === 'case_collaboration_received' ||
      subType === 'case_collaboration_returned' ||
      subType === 'case_collaboration_completed' ||
      subType === 'case_reviewing' ||
      item.type === 'case'
    ) {
      navigate(`/citizen/cases/${item.related_id}`);
      return;
    }

    if (item.type === 'appointment') {
      navigate('/citizen/appointments');
      return;
    }

    if (item.type === 'evaluation') {
      navigate('/citizen/evaluations');
      return;
    }

    navigate(`/citizen/cases/${item.related_id}`);
  };

  const getActionButtonText = (item: Notification): string => {
    if (item.sub_type && SubTypeActionText[item.sub_type]) {
      return SubTypeActionText[item.sub_type];
    }
    if (item.type === 'case') {
      return '查看办件';
    }
    if (item.type === 'appointment') {
      return '查看预约';
    }
    if (item.type === 'evaluation') {
      return '查看评价';
    }
    return '查看详情';
  };

  const hasActionButton = (item: Notification): boolean => {
    if (item.sub_type && SubTypeActionText[item.sub_type]) {
      return true;
    }
    if (item.type === 'case' && item.related_id) {
      return true;
    }
    if (item.type === 'appointment') {
      return true;
    }
    if (item.type === 'evaluation') {
      return true;
    }
    return false;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(notifications.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const renderItem = (item: Notification) => (
    <List.Item
      key={item.id}
      style={{
        cursor: 'pointer',
        backgroundColor: item.is_read === 0 ? '#f6ffed' : 'transparent',
        padding: '16px 24px',
      }}
      onClick={() => handleViewDetail(item)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ marginRight: 12, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onChange={(e) => handleSelectItem(item.id, e.target.checked)}
          />
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: item.is_read === 0 ? '#e6f7ff' : '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: item.is_read === 0 ? '#1890ff' : '#bfbfbf',
            fontSize: 18,
            marginRight: 16,
            flexShrink: 0,
          }}
        >
          {NotificationTypeIcon[item.type] || <BellOutlined />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <Space size={8}>
              {item.is_read === 0 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#ff4d4f',
                  }}
                />
              )}
              <span style={{ fontWeight: item.is_read === 0 ? 600 : 400, fontSize: 15 }}>
                {item.title}
              </span>
              <Tag color={NotificationTypeColor[item.type]} style={{ marginLeft: 8 }}>
                {NotificationTypeText[item.type]}
              </Tag>
            </Space>
          </div>
          <div style={{ color: '#666', marginBottom: 8 }}>{item.content}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
          </div>
        </div>
        <Space style={{ marginLeft: 16, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {item.is_read === 0 && (
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkAsRead(item.id)}
            >
              标记已读
            </Button>
          )}
          {hasActionButton(item) && (
            <Button type="link" size="small" onClick={() => handleJumpToRelated(item)}>
              {getActionButtonText(item)} <RightOutlined style={{ fontSize: 12 }} />
            </Button>
          )}
          <Button type="text" size="small" icon={<EyeOutlined />}>
            详情
          </Button>
        </Space>
      </div>
    </List.Item>
  );

  const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;
  const indeterminate = selectedIds.length > 0 && selectedIds.length < notifications.length;

  return (
    <div>
      <Card
        title="消息中心"
        extra={
          <Space>
            <span style={{ color: '#999', fontSize: 13 }}>
              已选择 <span style={{ color: '#1890ff', fontWeight: 600 }}>{selectedIds.length}</span> 条
            </span>
            <Button icon={<CheckOutlined />} onClick={handleBatchMarkAsRead} disabled={selectedIds.length === 0}>
              批量已读
            </Button>
            <Button onClick={handleMarkAllAsRead}>全部已读</Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Radio.Group
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
              buttonStyle="solid"
            >
              <Radio.Button value="all">全部通知</Radio.Button>
              <Radio.Button value="case">办件通知</Radio.Button>
              <Radio.Button value="appointment">预约通知</Radio.Button>
              <Radio.Button value="evaluation">评价通知</Radio.Button>
            </Radio.Group>
            <Checkbox
              indeterminate={indeterminate}
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
            >
              全选本页
            </Checkbox>
          </div>
          <Radio.Group
            value={onlyUnread ? 'unread' : 'all'}
            onChange={(e) => {
              setOnlyUnread(e.target.value === 'unread');
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
          >
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="unread">未读</Radio.Button>
          </Radio.Group>
        </Space>

        <Spin spinning={loading}>
          {notifications.length > 0 ? (
            <List
              itemLayout="horizontal"
              dataSource={notifications}
              renderItem={renderItem}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                onChange: (page, pageSize) =>
                  setPagination({ ...pagination, current: page, pageSize }),
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条消息`,
              }}
            />
          ) : (
            <Empty description="暂无消息" style={{ padding: '40px 0' }} />
          )}
        </Spin>
      </Card>

      <Drawer
        title="通知详情"
        placement="right"
        width={500}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
      >
        {currentDetail && (
          <div>
            {jumpTipVisible && (
              <Alert
                icon={<InfoCircleOutlined />}
                message="温馨提示"
                description={jumpTipMessage}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                closable
                onClose={() => setJumpTipVisible(false)}
              />
            )}
            <div style={{ marginBottom: 16 }}>
              <Tag color={NotificationTypeColor[currentDetail.type]}>
                {NotificationTypeText[currentDetail.type]}
              </Tag>
              {currentDetail.is_read === 1 && <Tag color="default">已读</Tag>}
            </div>
            <h3 style={{ marginBottom: 12 }}>{currentDetail.title}</h3>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ color: '#666', lineHeight: 1.8, marginBottom: 24 }}>
              {currentDetail.content}
            </div>
            <div style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>
              发送时间：{dayjs(currentDetail.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {hasActionButton(currentDetail) && (
              <Button
                type="primary"
                icon={<RightOutlined />}
                onClick={() => handleJumpToRelated(currentDetail)}
              >
                {getActionButtonText(currentDetail)}
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default CitizenNotifications;
