export function CollectionHeader({ title, arabicTitle }: { title: string; arabicTitle: string }) {
  return (
    <div className="collection-header" dir="ltr">
      <div className="collection-header__copy">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Collection
        </p>
        <h1 className="collection-header__title" dir="ltr">
          <span className="bidi-isolate">{title}</span>
        </h1>
        <p className="collection-header__arabic" dir="rtl" lang="ar">
          <span className="bidi-isolate">{arabicTitle}</span>{" "}
          <bdi dir="ltr" className="bidi-isolate">
            5ADSH
          </bdi>
        </p>
      </div>
    </div>
  );
}
