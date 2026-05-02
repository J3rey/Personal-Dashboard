const TABS = ['calendar', 'finance', 'habits', 'content']

export default function Nav({ activeTab, setActiveTab }) {
  return (
    <nav>
      <div className="nav-brand">
        <img src="/logo.png" alt="logo" className="nav-brand-logo" />
        <span>dashboard</span>
      </div>
      {TABS.map(tab => (
        <button
          key={tab}
          className={'nav-tab' + (activeTab === tab ? ' active' : '')}
          onClick={() => setActiveTab(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </nav>
  )
}
