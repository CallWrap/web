interface Props {
  callId: string;
  onClose: () => void;
}

/** 악성콜 종료 직후 상담사에게 뜨는 휴식 권고 팝업 (감정노동 보호) */
export function WellbeingModal({ callId, onClose }: Props) {
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="wb-title">
      <div className="modal">
        <div className="m-top">
          <div className="breathe" aria-hidden />
          <h3 id="wb-title">잠시 호흡을 고르세요</h3>
          <p>방금 통화(콜 {callId})가 악성콜로 분류되었습니다.</p>
        </div>
        <div className="m-body">
          <p style={{ margin: '0 0 10px', color: 'var(--text-2)' }}>
            힘든 통화를 마치셨습니다. 다음 상담 전에 잠깐의 휴식을 권장합니다.
          </p>
          <ul>
            <li>물 한 잔과 함께 어깨를 펴고 깊게 숨을 들이쉬세요.</li>
            <li>필요하면 대기 상태로 두고 3분간 자리를 비워도 됩니다.</li>
            <li>지속적으로 힘들다면 팀장 또는 심리지원 창구에 알려 주세요.</li>
          </ul>
        </div>
        <div className="m-foot">
          <button className="btn" onClick={onClose}>
            3분 휴식 후 검토
          </button>
          <button className="btn primary" onClick={onClose}>
            바로 검토 시작
          </button>
        </div>
      </div>
    </div>
  );
}
