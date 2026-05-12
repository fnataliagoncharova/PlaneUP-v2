import ShiftFactPanel from "../components/master-workspace/ShiftFactPanel";

function MasterWorkspaceSection() {
  return (
    <section className="space-y-6">
      <header className="glass-panel p-4 sm:p-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
          Рабочий стол мастера
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Фиксация факта выпуска по строкам недельного плана.
        </p>
      </header>

      <section className="glass-panel p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-tight text-slate-50">
          Факт выпуска за смену
        </h2>
        <div className="mt-5">
          <ShiftFactPanel />
        </div>
      </section>
    </section>
  );
}

export default MasterWorkspaceSection;
