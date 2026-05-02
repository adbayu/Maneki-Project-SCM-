import React from "react";
import { SunMedium, Activity, Droplet, Hash } from "lucide-react";

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

export function CalorieIcon(props: IconProps) {
  return <SunMedium {...props} />;
}

export function ProteinIcon(props: IconProps) {
  return <Activity {...props} />;
}

export function FatIcon(props: IconProps) {
  return <Droplet {...props} />;
}

export function CarboIcon(props: IconProps) {
  return <Hash {...props} />;
}

export default {
  CalorieIcon,
  ProteinIcon,
  FatIcon,
  CarboIcon,
};
