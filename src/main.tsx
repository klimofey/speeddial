import { render } from 'preact';
import './styles/global.css';
import { NewTab } from './components/NewTab';

render(<NewTab />, document.getElementById('app')!);
