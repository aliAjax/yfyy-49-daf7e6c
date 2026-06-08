import { useEffect, useMemo, useRef, useState } from 'react';
import './TicketDisplayScreen.css';

type TicketStatus = 'waiting' | 'calling' | 'processing' | 'completed' | 'cancelled';

interface DisplayTicket {
  id: string;
  ticket_number: string;
  service_item_name?: string;
  window_name?: string;
  window_number?: string;
  applicant_name?: string;
  status: TicketStatus;
  called_at?: string;
  created_at: string;
  updated_at: string;
}

interface DisplayWindow {
  id: string;
  name: string;
  number: string;
  current_ticket_number?: string;
  current_ticket_status?: TicketStatus;
  current_service_item_name?: string;
}

interface DisplayStats {
  waiting: number;
  calling: number;
  processing: number;
  completed: number;
  cancelled: number;
  total: number;
}

interface DisplayData {
  calling_tickets: DisplayTicket[];
  waiting_tickets: DisplayTicket[];
  stats: DisplayStats;
  windows: DisplayWindow[];
  current_time: string;
}

const emptyStats: DisplayStats = {
  waiting: 0,
  calling: 0,
  processing: 0,
  completed: 0,
  cancelled: 0,
  total: 0,
};

const statusText: Record<TicketStatus, string> = {
  waiting: '等待中',
  calling: '请前往',
  processing: '办理中',
  completed: '已完成',
  cancelled: '已过号',
};

function formatDate(date: Date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function TicketDisplayScreen() {
  const [data, setData] = useState<DisplayData | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const cachedDataRef = useRef<DisplayData | null>(null);

  const loadDisplayData = async () => {
    try {
      const response = await fetch('/api/tickets/display/screen?wait_limit=10', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const nextData = await response.json();
      cachedDataRef.current = nextData;
      setData(nextData);
      setLastUpdatedAt(new Date());
      setIsOffline(false);
    } catch (error) {
      console.error('叫号大屏数据刷新失败:', error);
      if (cachedDataRef.current) {
        setData(cachedDataRef.current);
      }
      setIsOffline(true);
    }
  };

  useEffect(() => {
    loadDisplayData();
    const dataTimer = window.setInterval(loadDisplayData, 3000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      window.clearInterval(dataTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const currentTicket = useMemo(() => {
    if (!data?.calling_tickets.length) return null;
    return data.calling_tickets[0];
  }, [data]);

  const secondaryTickets = useMemo(() => {
    return data?.calling_tickets.slice(1, 5) || [];
  }, [data]);

  const stats = data?.stats || emptyStats;
  const waitingTickets = data?.waiting_tickets || [];
  const windows = data?.windows || [];

  return (
    <main className="display-screen">
      <header className="display-header">
        <div>
          <h1>窗口叫号大屏</h1>
          <p>政务服务大厅</p>
        </div>
        <div className="display-clock">
          <strong>{formatTime(now)}</strong>
          <span>{formatDate(now)}</span>
        </div>
      </header>

      <section className="display-status">
        <span className={isOffline ? 'status-dot offline' : 'status-dot'} />
        <span>{isOffline ? '连接中，保留上一轮数据' : '实时刷新中'}</span>
        {lastUpdatedAt && <span>最后更新 {formatTime(lastUpdatedAt)}</span>}
      </section>

      <section className="display-grid">
        <aside className="display-panel calling-list">
          <h2>正在呼叫</h2>
          {secondaryTickets.length > 0 ? (
            <ul>
              {secondaryTickets.map((ticket) => (
                <li key={ticket.id}>
                  <strong>{ticket.ticket_number}</strong>
                  <span>{ticket.window_number ? `${ticket.window_number}号窗口` : ticket.window_name || '待分配窗口'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-small">暂无其他呼叫</div>
          )}
        </aside>

        <section className="hero-call">
          {currentTicket ? (
            <>
              <div className="call-label">{statusText[currentTicket.status]}</div>
              <div className="call-number">{currentTicket.ticket_number}</div>
              <div className="call-window">
                {currentTicket.window_number ? `${currentTicket.window_number}号窗口` : currentTicket.window_name || '请等待窗口分配'}
              </div>
              <div className="call-service">{currentTicket.service_item_name || '综合业务'}</div>
            </>
          ) : (
            <div className="no-call">
              <strong>暂无叫号</strong>
              <span>请留意屏幕提示</span>
            </div>
          )}
        </section>

        <aside className="display-panel waiting-list">
          <h2>等待队列</h2>
          {waitingTickets.length > 0 ? (
            <ol>
              {waitingTickets.slice(0, 8).map((ticket, index) => (
                <li key={ticket.id}>
                  <span>{index + 1}</span>
                  <strong>{ticket.ticket_number}</strong>
                  <em>{ticket.service_item_name || '综合业务'}</em>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-small">暂无等待号票</div>
          )}
        </aside>
      </section>

      <section className="stats-row">
        <div>
          <span>等待中</span>
          <strong>{stats.waiting}</strong>
        </div>
        <div>
          <span>呼叫中</span>
          <strong>{stats.calling}</strong>
        </div>
        <div>
          <span>办理中</span>
          <strong>{stats.processing}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{stats.completed}</strong>
        </div>
        <div>
          <span>今日总号</span>
          <strong>{stats.total}</strong>
        </div>
      </section>

      <section className="window-strip">
        {windows.length > 0 ? (
          windows.map((win) => (
            <div className="window-tile" key={win.id}>
              <span>{win.number}号窗口</span>
              <strong>{win.current_ticket_number || '空闲'}</strong>
              <em>{win.current_service_item_name || win.name}</em>
            </div>
          ))
        ) : (
          <div className="window-tile">
            <span>窗口状态</span>
            <strong>暂无开放窗口</strong>
            <em>请联系大厅工作人员</em>
          </div>
        )}
      </section>
    </main>
  );
}

export default TicketDisplayScreen;
