import planeUpLogoSrc from "../../assets/planeup-logo.png";

function PlaneUpLogo({ className = "", alt = "PlaneUP Production Planning" }) {
  return (
    <img
      src={planeUpLogoSrc}
      alt={alt}
      className={["block h-auto w-full object-contain", className].join(" ").trim()}
    />
  );
}

export default PlaneUpLogo;
