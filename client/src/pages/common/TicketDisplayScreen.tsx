import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import './TicketDisplayScreen.css';

interface WindowInfo {
  id: string;
  name: string;
  number: string;
  status: string;
  current_ticket: {
    ticket_number: string;
    status: string;
    applicant_name: string;
    service_item_name: string;
  } | null;
}

interface TicketInfo {
  id: string;
  ticket_number: string;
  service_item_name?: string;
  service_item_code?: string;
  window_name?: string;
  window_number?: string;
  applicant_name?: string;
  status: string;
  created_at: string;
}

interface ScreenData {
  calling_tickets: TicketInfo[];
  waiting_tickets: TicketInfo[];
  stats: {
    waiting: number;
    calling: number;
    processing: number;
    completed: number;
    cancelled: number;
    total: number;
  };
  windows: WindowInfo[];
  current_time: string;
}

const POLL_INTERVAL = 3000;

function TicketDisplayScreen() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [isError, setIsError] = useState(false);
  const prevDataRef = useRef<ScreenData | null>(null);
  const timerRef = useRef<number | null>(null);
  const timeTimerRef = useRef<number | null>(null);

  const formatDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    setDateText(`${year}年${month}月${day}日 ${weekday}`);
    setTimeText(`${hours}:${minutes}:${seconds}`);
  };

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/tickets/display/screen', {
        params: { wait_limit: 10 },
        timeout: 10000,
      });
      const newData = response.data;
      setData(newData);
      prevDataRef.current = newData;
      setIsError(false);
    } catch (error) {
      console.error('获取大屏数据失败:', error);
      setIsError(true);
      if (prevDataRef.current) {
        setData(prevDataRef.current);
      }
    }
  };

  useEffect(() => {
    formatDateTime();
    fetchData();

    timerRef.current = window.setInterval(fetchData, POLL_INTERVAL);
    timeTimerRef.current = window.setInterval(formatDateTime, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (timeTimerRef.current) {
        clearInterval(timeTimerRef.current);
      }
    };
  }, []);

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      calling: '已呼叫',
      processing: '办理中',
      waiting: '等待中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return map[status] || status;
  };

  const mainTicket = data?.calling_tickets?.[0];
  const otherCallingTickets = data?.calling_tickets?.slice(1, 5) || [];

  return (
    <div className="display-screen">
      <div className="screen-header">
        <div className="header-left">
          <div className="hall-name">政务服务大厅</div>
          <div className="screen-subtitle">叫号显示屏</div>
        </div>
        <div className="header-center">
          <div className="date-display">{dateText}</div>
          <div className="time-display">{timeText}</div>
        </div>
        <div className="header-right">
          {isError && (
            <div className="status-badge warning">
              <span className="dot"></span>
              连接中...
            </div>
          )}
          {!isError && data && (
            <div className="status-badge ok">
              <span className="dot"></span>
              实时更新
            </div>
          )}
        </div>
      </div>

      <div className="screen-body">
        <div className="left-panel">
          <div className="panel-header">
            <span className="panel-icon">📢</span>
            <span className="panel-title">当前叫号</span>
          </div>
          <div className="calling-list">
            {otherCallingTickets.length > 0 ? (
              otherCallingTickets.map((ticket) => (
                <div key={ticket.id} className="calling-item">
                  <div className="ticket-no">{ticket.ticket_number}</div>
                  <div className="ticket-info">
                    <div className="window-info">
                      <span className="window-label">窗口</span>
                      <span className="window-no">{ticket.window_number || '-'}号</span>
                    </div>
                    <div className="service-name">{ticket.service_item_name}</div>
                  </div>
                  <div className={`status-tag ${ticket.status}`}>
                    {getStatusText(ticket.status)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-tip">暂无其他叫号</div>
            )}
          </div>
        </div>

        <div className="center-panel">
          <div className="main-display">
            <div className="main-prompt">请 您 到</div>
            {mainTicket ? (
              <>
                <div className="main-ticket" key={mainTicket.id}>
                  {mainTicket.ticket_number}
                </div>
                <div className="main-window-info">
                  <div className="main-window">{mainTicket.window_number || '-'} 号窗口</div>
                  <div className="main-service">{mainTicket.service_item_name}</div>
                </div>
              </>
            ) : (
              <>
                <div className="main-empty">等待叫号中</div>
                <div className="main-empty-sub">请留意叫号信息</div>
              </>
            )}
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <div className="stat-num">{data?.stats?.waiting || 0}</div>
              <div className="stat-label">等待人数</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{(data?.stats?.calling || 0) + (data?.stats?.processing || 0)}</div>
              <div className="stat-label">办理中</div>
            </div>
            <div className="stat-item success">
              <div className="stat-num">{data?.stats?.completed || 0}</div>
              <div className="stat-label">已完成</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{data?.stats?.total || 0}</div>
              <div className="stat-label">今日总号</div>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="panel-header">
            <span className="panel-icon">📋</span>
            <span className="panel-title">等待队列</span>
            <span className="wait-count">共 {data?.stats?.waiting || 0} 人</span>
          </div>
          <div className="waiting-list">
            {data?.waiting_tickets && data.waiting_tickets.length > 0 ? (
              data.waiting_tickets.map((ticket, index) => (
                <div key={ticket.id} className={`waiting-item rank-${index + 1}`}>
                  <div className={`rank-badge rank-${index + 1}`}>
                    {index + 1}
                  </div>
                  <div className="waiting-info">
                    <div className="waiting-ticket-no">{ticket.ticket_number}</div>
                    <div className="waiting-service">{ticket.service_item_name}</div>
                  </div>
                  {index === 0 && <div className="next-tag">下一位</div>}
                </div>
              ))
            ) : (
              <div className="empty-tip">暂无等待</div>
            )}
          </div>
        </div>
      </div>

      <div className="screen-footer">
        <div className="windows-section">
          <div className="footer-title">
            <span className="footer-icon">🪟</span>
            窗口状态
          </div>
          <div className="windows-container">
            {data?.windows && data.windows.length > 0 ? (
              data.windows.map((window) => (
                <div key={window.id} className="window-card">
                  <div className="window-no">{window.number}号窗口</div>
                  <div className="window-name">{window.name}</div>
                  <div className="window-status-area">
                    {window.current_ticket ? (
                      <>
                        <div className="window-ticket-no">{window.current_ticket.ticket_number}</div>
                        <div className="window-ticket-status">
                          {getStatusText(window.current_ticket.status)}
                        </div>
                      </>
                    ) : (
                      <div className="window-idle">空闲中</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-tip">暂无窗口信息</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketDisplayScreen;
