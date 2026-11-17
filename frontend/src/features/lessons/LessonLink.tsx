import { Link, type LinkProps } from 'react-router-dom';
import { useLessonExperience } from './LessonExperience';

/** Shared lesson content stays in the selected experience; Legacy URLs are unchanged. */
export function LessonLink({ to, ...props }: LinkProps) {
  const { enabled } = useLessonExperience();
  const destination =
    enabled &&
    typeof to === 'string' &&
    /^\/(learn\/|break\/|contacts(?:[/?#]|$)|experiments(?:[/?#]|$))/.test(to)
      ? `/playground${to}`
      : to;
  return <Link {...props} to={destination} />;
}
