import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { palette } from '@/theme';

import { TextField, type TextFieldRef } from './TextField';

describe('TextField', () => {
  it('is labeled and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'marcus@example.com');
    expect(onChangeText).toHaveBeenCalledWith('marcus@example.com');
  });

  it('shows an error as an alert in the destructive color', async () => {
    await render(<TextField label="Email" value="" error="Enter your email." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter your email.');
    expect(alert).toHaveStyle({ color: palette.destructive });
  });

  it('shows the hint when there is no error, and the error instead of the hint', async () => {
    await render(<TextField label="Initiated" value="" hint="Like Spring 2019" />);
    expect(screen.getByText('Like Spring 2019')).toBeTruthy();
    await render(<TextField label="Initiated" value="" hint="Like Spring 2019" error="Required" />);
    expect(screen.queryByText('Like Spring 2019')).toBeNull();
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('hides passwords until Show is tapped', async () => {
    await render(<TextField label="Password" value="secret12" secure />);
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  });

  it('has no Show button for regular fields', async () => {
    await render(<TextField label="Name" value="" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveProp('secureTextEntry', false);
  });

  it('forwards its ref to the input so forms can move focus', async () => {
    const ref = createRef<TextFieldRef>();
    await render(<TextField ref={ref} label="Name" value="" />);
    expect(ref.current).toBeTruthy();
  });
});
