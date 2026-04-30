const TABS = ['calendar', 'finance', 'habits', 'content']

export default function Nav({ activeTab, setActiveTab }) {
  return (
    <nav>
      <span className="nav-brand">dashboard</span>
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
