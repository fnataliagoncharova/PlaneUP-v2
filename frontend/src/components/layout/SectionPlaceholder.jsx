function SectionPlaceholder({ title, description, icon: Icon }) {
  return (
    <section className="glass-panel flex min-h-[480px] items-center justify-center p-6 sm:p-10">
      <div className="max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-none border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 shadow-cyanGlow">
          <Icon className="h-9 w-9" />
        </div>

        <div className="panel-title mt-8">Следующий этап</div>
        <h1 className="mt-4 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-300">{description}</p>

        <div className="mt-8 inline-flex items-center rounded-none border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400">
          Раздел оставлен как стилистически согласованная заглушка до следующего шага.
        </div>
      </div>
    </section>
  );
}

export default SectionPlaceholder;
