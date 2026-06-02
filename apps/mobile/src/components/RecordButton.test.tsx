import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordingState } from '@voice2spec/shared-types';
import { RecordButton } from './RecordButton';

describe('RecordButton', () => {
  it('shows "Start" when idle', () => {
    const { getByText } = render(<RecordButton state={RecordingState.Idle} onPress={() => {}} />);
    expect(getByText('Start')).toBeTruthy();
  });

  it('shows "Stop & Generate" when recording', () => {
    const { getByText } = render(
      <RecordButton state={RecordingState.Recording} onPress={() => {}} />,
    );
    expect(getByText('Stop & Generate')).toBeTruthy();
  });

  it('is disabled and shows progress while generating', () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = render(
      <RecordButton state={RecordingState.Generating} onPress={onPress} />,
    );
    expect(getByText('Generating…')).toBeTruthy();
    fireEvent.press(getByTestId('record-button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires onPress when tapped in an active state', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <RecordButton state={RecordingState.Idle} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('record-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
