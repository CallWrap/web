interface Props {
  label: string;
  /** 왜 아직 측정치가 없는지 + 무엇이 갖춰지면 측정되는지, 한 문장으로 */
  plan: string;
}

/** 실측치가 없는 지표를 위한 표준 표시. '—'나 '미구현'을 쓰지 않고,
 * "무엇이 갖춰지면 언제 채워지는지"를 항상 함께 보여준다. */
export function PendingMetric({ label, plan }: Props) {
  return (
    <div className="metric measure-metric pending">
      <div className="label">{label}</div>
      <div className="value"><span style={{ fontSize: '0.5em', color: 'var(--text-3)' }}>측정 예정</span></div>
      <div className="sub">{plan}</div>
    </div>
  );
}
