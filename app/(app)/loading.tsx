export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="skel h-7 w-52 mb-2" />
        <div className="skel h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skel h-[104px]" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
        <div className="skel h-64" />
        <div className="skel h-64" />
      </div>
    </div>
  );
}
