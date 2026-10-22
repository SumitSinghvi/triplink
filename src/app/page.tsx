export default function Home() {
  return (
    <main className="w-screen h-screen m-0 p-0 overflow-hidden bg-black flex">
      <iframe
        src="/triplink.html"
        title="TripLink App Prototype"
        className="w-full h-full border-none block flex-1"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          margin: 0,
          padding: 0,
        }}
      />
    </main>
  );
}
