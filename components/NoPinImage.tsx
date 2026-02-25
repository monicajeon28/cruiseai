import Image, { ImageProps } from "next/image";

// 모든 이미지에 Pinterest 저장 금지 attribute 주입
export default function NoPinImage(props: ImageProps) {
  return (
    <Image
      {...props}
      // Pinterest 확장/위젯이 읽는 속성
      data-pin-nopin="true"
      data-pin-no-hover="true"
      data-pin-save="false"
      // 혹시 <img>로 가는 경우도 대비
      alt={props.alt ?? ""}
    />
  );
} 