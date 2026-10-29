const attachments = [
  {
    name: "SSO_Workflow_v2.pdf",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCnioEcBWRclDpkn2GE3YQgU8h9DooevI6yfUCOYuK_fL2elgexTpe9hMM6q1mVnMGa7Qo0C5zjvLhWvMymwCt7mMsMNpkv3TQllSUY0ZS-SFcYDU75qpPJKY1ahJcvNwseyf41rZ-gEtKvQ9pRnHta34S3C9RbkHdC8qZcfTUFE9xwFU9yiSo55g6JN7Z4FzMbVDTNOiYFf3fokcfb5IWB6jQY2jZ7F0bjCRNPG4yNaXHJk5b5N53eKMGrn59t1s9re5EtaukFEMk",
  },
  {
    name: "API_Security_Spec.pdf",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDbIfd9Lv7lEWwFDatBhOty1VKxc6DrL1SJT3Zg-Dnx4Y-aeg7RsOFCxKX048wX7FS0gWQOVBxi874AaV3uuBk_0kytvpDgOOSS1p_AB7CqA-fNZXGpXYoKFfkQnU3CKMRKB02ZjYcwXZQn6K1GwgyY_M3ZaLyRPrSLnnjAN-cIxmkilV9mk50a3odvfzP3UZv5y7vKsPOgW3CM9jktOwgLufCQB6VnNvo9c4olbd5ax_quygRUS7MbbICkNbOp0e9LPGiTMjCjzKg",
  },
];

const comments = [
  {
    id: 1,
    name: "Sarah Miller",
    time: "2 hours ago",
    text: "Need clarification on the API endpoints for the secondary provider. Are we using the v2 discovery document?",
    likes: 1,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA-dhONZ1InTMfldDdZRC1jfak59Yv0w1GhaJN5CR2-8d2DrXisnwG5s--zectMa2Kh8i_NSpGtEWoXpChwandWMb90EGC6AwKw8lBF7r1zcduLktC_FFlAUurshpGkrECBPW0rnszkMeptmKaZXl3jFpRLc6B3ZziY6lq7TtM1C9nAfRmLrZzkVFMjCd3TFpEpxOBOX0kwCrnujf8GbAUzA554DJe8d4lgtSSG9jf5vyUg6zNGMYNpl0W780yXTAW1XJpLIZ5cRiY",
  },
];

const currentUserAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDLcOBYEcguPHsxx-4oVeeeTs7bPdeJAqRidamI76xmbUAL-wrxlq82qbJUIrjnGTTjGcXeRRXnL8yMmznKPPrEfhd4XCOVzNxmT7icitJS0XZQZZFzhfn9-WO4cojlr6tiRDsaVk3tUCISGX5jmS33cw5IQxT0WKu_xRvy-0WQ1ZPZhXuUzB8c04Z5J8iL0kI1bgEMg9FHPzEnESGd3txbqiPk0BJYRhHGerZgdF0YjUayQSW394a2c-1qx3zPIyccdrE80SJfNSo";

export default function StoryContent({ story, onClose }) {
  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
          <span className="material-symbols-outlined text-sm">task_alt</span>
          <span>User Story — {story.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-outline">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-outline">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-error-container hover:text-error rounded-full transition-colors text-outline ml-2"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-10">
        {/* Title & Description */}
        <section>
          <h2 className="font-['Manrope'] font-extrabold text-3xl text-on-surface leading-tight mb-4">
            {story.title}
          </h2>
          <div className="text-on-surface-variant font-['Inter'] leading-relaxed space-y-4">
            <p>
              {story.description || "No description provided."}
            </p>
            <h4 className="font-bold text-on-surface mt-6 mb-2">Acceptance Criteria</h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Integration with Okta and Azure AD providers.</li>
              <li>Secure token storage following industry best practices.</li>
              <li>Automatic session expiration after 24 hours of inactivity.</li>
              <li>Fallback to standard email login if SSO is unavailable.</li>
            </ul>
          </div>
        </section>

        {/* Attachments */}
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-outline mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">attach_file</span>
            Attachments ({attachments.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {attachments.map((file) => (
              <div
                key={file.name}
                className="group relative aspect-[4/3] bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer"
              >
                <img
                  src={file.src}
                  alt={file.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[10px] text-white font-medium truncate">{file.name}</p>
                </div>
              </div>
            ))}
            {/* Add file */}
            <div className="border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center text-outline hover:text-primary hover:border-primary transition-all cursor-pointer aspect-[4/3]">
              <span className="material-symbols-outlined text-3xl mb-1">add_circle</span>
              <span className="text-[10px] font-bold">ADD FILE</span>
            </div>
          </div>
        </section>

        {/* Discussion */}
        <section className="border-t border-outline-variant/20 pt-8">
          <h4 className="text-xs font-bold uppercase tracking-wider text-outline mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">forum</span>
            Discussion
          </h4>
          <div className="space-y-6">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-4">
                <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full shrink-0 object-cover" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-on-surface">{c.name}</span>
                    <span className="text-[10px] text-outline">{c.time}</span>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-2xl rounded-tl-none text-sm text-on-surface-variant">
                    {c.text}
                  </div>
                  <div className="flex items-center mt-2 gap-4">
                    <button className="text-[10px] font-bold text-outline hover:text-primary">REPLY</button>
                    <button className="text-[10px] font-bold text-outline hover:text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">thumb_up</span>
                      {c.likes}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Comment input */}
            <div className="flex gap-4 pt-4">
              <img src={currentUserAvatar} alt="You" className="w-10 h-10 rounded-full shrink-0 object-cover" />
              <div className="flex-1 relative">
                <textarea
                  className="w-full bg-surface-container-low border-none rounded-2xl p-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all resize-none min-h-[80px]"
                  placeholder="Write a comment..."
                />
                <button className="absolute bottom-3 right-3 p-2 bg-primary text-on-primary rounded-xl shadow-lg active:scale-95 transition-transform">
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
