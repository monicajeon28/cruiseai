export default function QuickActions(){
  const items = [
    { label:"나의 정보",       icon:"👤" },
    { label:"여행준비물 체크", icon:"🧳" },
    { label:"환율 계산기",     icon:"📈" },
    { label:"번역기",         icon:"🔤" },
  ];
  return (
    <>
      {items.map(i=>(
        <button key={i.label} className="cg-v2-quick">
          <span className="text-xl">{i.icon}</span>
          <span className="ml-2">{i.label}</span>
        </button>
      ))}
    </>
  );
}
