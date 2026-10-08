export function groupFindings(findings) {
  const groups = new Map();
  findings.forEach(finding => {
    const key = `${finding.rule}|${finding.issue}`;
    const group = groups.get(key);
    const references = finding.evidenceReferences || [{
      id: finding.id,
      selector: finding.selector
    }];
    if (group) {
      group.count++;
      group.references.push(...references);
      return;
    }
    groups.set(key, {
      ...finding,
      count: 1,
      references: [...references]
    });
  });
  return [...groups.values()];
}
